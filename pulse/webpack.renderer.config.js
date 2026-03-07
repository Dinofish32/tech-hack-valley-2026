const rules = require('./webpack.rules');

rules.push({
  test: /\.css$/,
  use: [
    { loader: 'style-loader' },
    { loader: 'css-loader' },
    { loader: 'postcss-loader' },
  ],
});

rules.push({
  test: /\.(js|jsx)$/,
  exclude: /node_modules/,
  use: {
    loader: 'babel-loader',
    options: {
      presets: ['@babel/preset-env', '@babel/preset-react'],
    },
  },
});

module.exports = {
  resolve: {
    extensions: ['.js', '.jsx'],
    fallback: {
      'bufferutil': false,
      'utf-8-validate': false,
    },
  },
  module: {
    rules,
  },
  externals: {
    'bufferutil': 'commonjs bufferutil',
    'utf-8-validate': 'commonjs utf-8-validate',
    '@abandonware/bluetooth-hci-socket': 'commonjs @abandonware/bluetooth-hci-socket',
  },
};
