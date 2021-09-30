// Copyright (C) 2020 Storj Labs, Inc.
// See LICENSE for copying information.

package version

import _ "unsafe" // needed for go:linkname

//go:linkname buildTimestamp storj.io/private/version.buildTimestamp
var buildTimestamp string = "1633009147"

//go:linkname buildCommitHash storj.io/private/version.buildCommitHash
var buildCommitHash string = "69882736c66b1534126010e739b834526d5fc6d4"

//go:linkname buildVersion storj.io/private/version.buildVersion
var buildVersion string = "v1.40.2-rc"

//go:linkname buildRelease storj.io/private/version.buildRelease
var buildRelease string = "true"

// ensure that linter understands that the variables are being used.
func init() { use(buildTimestamp, buildCommitHash, buildVersion, buildRelease) }

func use(...interface{}) {}
