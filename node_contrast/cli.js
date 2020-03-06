#!/usr/bin/env node
/**
Copyright: 2020 Contrast Security, Inc
  Contact: support@contrastsecurity.com
  License: Commercial

  NOTICE: This Software and the patented inventions embodied within may only be
  used as part of Contrast Security’s commercial offerings. Even though it is
  made available through public repositories, use of this Software is subject to
  the applicable End User Licensing Agreement found at
  https://www.contrastsecurity.com/enduser-terms-0317a or as otherwise agreed
  between Contrast Security and the End User. The Software may not be reverse
  engineered, modified, repackaged, sold, redistributed or otherwise used in a
  way not consistent with the End User License Agreement.
*/
const path = require('path');
const fs = require('fs');
require('./loader.js');
let PATH;

// for local development
if (fs.existsSync(`${__dirname + path.sep}lib`)) {
  PATH = './lib/cli';
} else {
  PATH = './lib.asar/cli';
}

const cli = require(PATH);
cli.main(process.argv);
