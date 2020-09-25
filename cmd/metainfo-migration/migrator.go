package main

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"storj.io/common/pb"
	"storj.io/common/uuid"
	"storj.io/storj/cmd/metainfo-migration/metabase"
	"storj.io/storj/satellite/metainfo"
	"storj.io/storj/storage"
)

const batchSize = 500
const objectsArgs = 10
const segmentsArgs = 9

type Migrator struct {
	PointerDB metainfo.PointerDB
	Metabase  *metabase.Metabase

	ProjectID  uuid.UUID
	BucketName []byte

	BatchSize int

	ObjectsSQL     string
	Objects        []interface{}
	ObjectsCreated int

	SegmentsSQL     string
	Segments        []interface{}
	SegmentsCreated int
}

func NewMigrator(db metainfo.PointerDB, metabase *metabase.Metabase, projectID uuid.UUID, bucketName []byte) *Migrator {
	return &Migrator{
		PointerDB: db,
		Metabase:  metabase,

		ProjectID:  projectID,
		BucketName: bucketName,

		BatchSize: batchSize,

		ObjectsSQL: preparObjectsSQL(batchSize),
		Objects:    make([]interface{}, 0, batchSize*objectsArgs),

		SegmentsSQL: preparSegmentsSQL(batchSize),
		Segments:    make([]interface{}, 0, batchSize*segmentsArgs),
	}
}

func (m *Migrator) MigrateBucket(ctx context.Context) error {
	path, err := metainfo.CreatePath(ctx, m.ProjectID, -1, m.BucketName, nil)
	if err != nil {
		return err
	}

	more := true
	lastKey := storage.Key{}
	pointer := &pb.Pointer{}
	key := path.Encode()
	for more {
		more, err = storage.ListV2Iterate(ctx, m.PointerDB, storage.ListOptions{
			Prefix:       storage.Key(key),
			StartAfter:   lastKey,
			Recursive:    true,
			Limit:        int(0),
			IncludeValue: true,
		}, func(ctx context.Context, item *storage.ListItem) error {
			err = pb.Unmarshal(item.Value, pointer)
			if err != nil {
				return err
			}

			encodedPath := item.Key
			if encodedPath[0] == '/' {
				encodedPath = encodedPath[1:]
			}

			err = m.insertObject(ctx, encodedPath, pointer)
			if err != nil {
				return err
			}

			lastKey = item.Key
			return nil
		})
		if err != nil {
			return err
		}
	}

	if len(m.Objects) != 0 {
		sql := preparObjectsSQL(len(m.Objects) / objectsArgs)
		err := m.Metabase.Exec(ctx, sql, m.Objects...)
		if err != nil {
			return err
		}
		m.ObjectsCreated += len(m.Objects) / objectsArgs
	}

	if len(m.Segments) != 0 {
		sql := preparSegmentsSQL(len(m.Segments) / segmentsArgs)
		err := m.Metabase.Exec(ctx, sql, m.Segments...)
		if err != nil {
			return err
		}
		m.SegmentsCreated += len(m.Segments) / segmentsArgs
	}

	return nil
}

func (m *Migrator) insertObject(ctx context.Context, encryptedPath []byte, pointer *pb.Pointer) error {
	streamMeta := &pb.StreamMeta{}
	err := pb.Unmarshal(pointer.Metadata, streamMeta)
	if err != nil {
		return err
	}

	segmentsCount := streamMeta.NumberOfSegments
	if segmentsCount == 0 {
		return errors.New("unsupported case")
	}

	streamID, err := uuid.New()
	if err != nil {
		return err
	}

	m.Objects = append(m.Objects, m.ProjectID, m.BucketName, encryptedPath, -1, streamID,
		pointer.CreationDate, pointer.ExpirationDate,
		metabase.Committed, segmentsCount,
		pointer.Metadata)

	if len(m.Objects)/objectsArgs >= m.BatchSize {
		err = m.sendObjects(ctx)
		if err != nil {
			return err
		}
	}

	err = m.insertSegment(ctx, streamID, segmentsCount-1, pointer, streamMeta)
	if err != nil {
		return err
	}

	keys := storage.Keys{}
	for i := int64(0); i < segmentsCount-1; i++ {
		path, err := metainfo.CreatePath(ctx, m.ProjectID, i, m.BucketName, encryptedPath)
		if err != nil {
			return err
		}
		// TODO drop whole object if one segment is missing (zombie segment)
		keys = append(keys, storage.Key(path.Encode()))
	}

	if len(keys) != 0 {
		segmentPointer := &pb.Pointer{}

		// TODO is GetAll returns in the same order as keys?
		values, err := m.PointerDB.GetAll(ctx, keys)
		if err != nil {
			return err
		}

		for i, value := range values {
			err = pb.Unmarshal(value, segmentPointer)
			if err != nil {
				return err
			}

			err = m.insertSegment(ctx, streamID, int64(i), segmentPointer, nil)
			if err != nil {
				return err
			}
		}
	}

	return nil
}

func (m *Migrator) insertSegment(ctx context.Context, streamID uuid.UUID, segmentIndex int64, pointer *pb.Pointer, streamMeta *pb.StreamMeta) error {
	segmentPosition := metabase.SegmentPosition{
		Part:    0,
		Segment: uint32(segmentIndex),
	}

	rootPieceID := []byte{}
	if pointer.Remote != nil {
		rootPieceID = pointer.Remote.RootPieceId.Bytes()
	}

	if streamMeta == nil {
		streamMeta = &pb.StreamMeta{}
		err := pb.Unmarshal(pointer.Metadata, streamMeta)
		if err != nil {
			return err
		}
	}

	encryptedKey := []byte{}
	encryptedKeyNonce := []byte{}
	if streamMeta.LastSegmentMeta != nil {
		encryptedKey = streamMeta.LastSegmentMeta.EncryptedKey
		encryptedKeyNonce = streamMeta.LastSegmentMeta.KeyNonce
	}

	m.Segments = append(m.Segments, streamID, segmentPosition.Encode(), rootPieceID,
		encryptedKey, encryptedKeyNonce,
		int32(pointer.SegmentSize), 0, pointer.InlineSegment,
		metabase.NodeAliases{1}.Encode())

	if len(m.Segments)/segmentsArgs >= m.BatchSize {
		err := m.sendSegments(ctx)
		if err != nil {
			return err
		}
	}

	return nil
}

func (m *Migrator) sendObjects(ctx context.Context) error {
	if len(m.Objects) == 0 {
		return nil
	}

	err := m.Metabase.Exec(ctx, m.ObjectsSQL, m.Objects...)
	if err != nil {
		return err
	}
	m.ObjectsCreated += len(m.Objects) / objectsArgs

	m.Objects = m.Objects[:0]

	return nil
}

func (m *Migrator) sendSegments(ctx context.Context) error {
	if len(m.Segments) == 0 {
		return nil
	}

	err := m.Metabase.Exec(ctx, m.SegmentsSQL, m.Segments...)
	if err != nil {
		return err
	}
	m.SegmentsCreated += len(m.Segments) / segmentsArgs

	m.Segments = m.Segments[:0]

	return nil
}

func preparObjectsSQL(batchSize int) string {
	sql := `
		INSERT INTO objects (
				project_id, bucket_name, object_key, version, stream_id,
				created_at, expires_at,
				status, segment_count,
				encrypted_metadata_nonce
		) VALUES 
	`
	i := 1
	for i < batchSize*objectsArgs {
		// TODO make it cleaner
		sql += fmt.Sprintf("($%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d),",
			i, i+1, i+2, i+3, i+4, i+5, i+6, i+7, i+8, i+9)
		i += objectsArgs
	}
	return strings.TrimSuffix(sql, ",")
}

func preparSegmentsSQL(batchSize int) string {
	sql := `INSERT INTO segments (
		stream_id, segment_position, root_piece_id,
		encrypted_key, encrypted_key_nonce,
		encrypted_data_size, unencrypted_data_size, inline_data,
		node_aliases
	) VALUES 
	`
	i := 1
	for i < batchSize*segmentsArgs {
		sql += fmt.Sprintf("($%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d),",
			i, i+1, i+2, i+3, i+4, i+5, i+6, i+7, i+8)
		i += segmentsArgs
	}

	// fmt.Println(sql)
	return strings.TrimSuffix(sql, ",")
}
