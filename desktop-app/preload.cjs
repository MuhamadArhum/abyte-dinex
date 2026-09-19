const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('abyteDesktop', {
  isDesktop: true,
});
