// electron-builder config (alternative to forge for distribution)
module.exports = {
  appId: 'com.puls8.app',
  productName: 'Puls8',
  directories: { output: 'dist' },
  files: ['src/**/*', 'assets/**/*', 'package.json'],
  win: {
    target: 'nsis',
    icon: 'assets/icon.png',
  },
  mac: {
    target: 'dmg',
    icon: 'assets/icon.png',
  },
  linux: {
    target: 'AppImage',
    icon: 'assets/icon.png',
  },
};
