module.exports = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: './src/main/index.js',
  // Put your normal webpack config below here
  module: {
    rules: require('./webpack.rules'),
  },
  externals: {
    'bufferutil': 'commonjs bufferutil',
    'utf-8-validate': 'commonjs utf-8-validate',
    'better-sqlite3': 'commonjs better-sqlite3',
    '@abandonware/bluetooth-hci-socket': 'commonjs @abandonware/bluetooth-hci-socket',
    'serialport': 'commonjs serialport',
    '@serialport/bindings-cpp': 'commonjs @serialport/bindings-cpp',
  },
};
