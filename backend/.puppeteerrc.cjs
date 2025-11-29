const {join} = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Don't download Chrome during npm install
  skipDownload: true,
};
