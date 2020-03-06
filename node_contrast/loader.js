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
/* global getOrCreateArchive, invalidArchiveError, notFoundError */
(function() {
  const hooker = require('hooker');
  const Module = require('module');
  const asar = require('asar');
  const fs = require('fs');
  const path = require('path');

  // Methods from Module
  function statPath(path) {
    try {
      return fs.statSync(path);
    } catch (ex) {
      /* */
    }
    return false;
  }

  // tryFile barrowed from pre 4.0 so we can hook fs.statSync and realpathSync
  function tryFile(requestPath) {
    const stats = statPath(requestPath);
    if (stats && !stats.isDirectory()) {
      return fs.realpathSync(requestPath, Module._realpathCache);
    }
    return false;
  }

  function tryExtensions(p, exts) {
    for (let i = 0, EL = exts.length; i < EL; i++) {
      const filename = tryFile(p + exts[i]);

      if (filename) {
        return filename;
      }
    }
    return false;
  }

  function tryPackage(requestPath, exts) {
    const pkg = readPackage(requestPath);

    if (!pkg) return false;

    const filename = path.resolve(requestPath, pkg);
    return (
      tryFile(filename) ||
      tryExtensions(filename, exts) ||
      tryExtensions(path.resolve(filename, 'index'), exts)
    );
  }

  const packageMainCache = {};

  function hasOwnProperty(obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop);
  }

  function readPackage(requestPath) {
    if (hasOwnProperty(packageMainCache, requestPath)) {
      return packageMainCache[requestPath];
    }

    let jsonPath, json;
    try {
      jsonPath = path.resolve(requestPath, 'package.json');
      json = fs.readFileSync(jsonPath, 'utf8');
    } catch (e) {
      return false;
    }

    let pkg;
    try {
      pkg = packageMainCache[requestPath] = JSON.parse(json).main;
    } catch (e) {
      e.path = jsonPath;
      e.message = `Error parsing ${jsonPath}: ${e.message}`;
      throw e;
    }
    return pkg;
  }

  const splitPath = function(p) {
    if (typeof p !== 'string') {
      return [false];
    }
    if (p.substr(-5) === '.asar') {
      return [true, p, ''];
    }
    const index = p.lastIndexOf(`.asar${path.sep}`);
    if (index === -1) {
      return [false];
    }
    return [true, p.substr(0, index + 5), p.substr(index + 6)];
  };

  hooker.hook(Module, '_findPath', {
    post(result, request, paths) {
      if (!paths) {
        return false;
      }
      const cacheKey = resolveCacheKey(request, paths);
      // https://github.com/nodejs/node/blob/57003520f83a9431dbef0dfce2edacf430923f20/lib/module.js
      const exts = Object.keys(Module._extensions);
      const trailingSlash = request.slice(-1) === path.sep;

      if (request.charAt(0) === path.sep) {
        paths = [''];
      }

      if (Module._pathCache[cacheKey]) {
        return Module._pathCache[cacheKey];
      }

      return checkDependencies(paths, request, exts, cacheKey, trailingSlash);
    }
  });

  function resolveCacheKey(request, paths) {
    return `${request}\x00${
      paths.length === 1 ? paths[0] : paths.join('\x00')
    }`;
  }

  function checkDependencies(paths, request, exts, cacheKey, trailingSlash) {
    for (let i = 0; i < paths.length; i++) {
      const basePath = path.resolve(paths[i], request);
      let filename;

      if (!trailingSlash) {
        // try to join the request to the path
        // try it with each of the extensions
        filename = tryFile(basePath) || tryExtensions(basePath, exts);
      }

      if (!filename) {
        filename =
          tryPackage(basePath, exts) ||
          // try it with each of the extensions at "index"
          tryExtensions(path.resolve(basePath, 'index'), exts);
      }

      if (filename) {
        Module._pathCache[cacheKey] = filename;
        return hooker.override(filename);
      }
    }
  }

  // TODO fork require asar-require to add these fixes.
  let nextInode = 0;

  const uid = process.getuid != null ? process.getuid() : 0;

  const gid = process.getgid != null ? process.getgid() : 0;

  const fakeTime = new Date();

  const asarStatsToFsStats = function(stats) {
    const isFile = !stats.files;
    return {
      dev: 1,
      ino: ++nextInode,
      mode: 33188,
      nlink: 1,
      uid,
      gid,
      rdev: 0,
      atime: stats.atime || fakeTime,
      birthtime: stats.birthtime || fakeTime,
      mtime: stats.mtime || fakeTime,
      ctime: stats.ctime || fakeTime,
      size: stats.size,
      isFile() {
        return isFile;
      },
      isDirectory() {
        return !isFile;
      },
      isSymbolicLink() {
        return false;
      },
      isBlockDevice() {
        return false;
      },
      isCharacterDevice() {
        return false;
      },
      isFIFO() {
        return false;
      },
      isSocket() {
        return false;
      }
    };
  };

  const { readFileSync } = fs;

  fs.readFileSync = function(...args) {
    const [path] = args;
    const [isAsar, asarPath, filePath] = splitPath(path);

    if (!isAsar) {
      return readFileSync.apply(this, args);
    }

    let [, options = {}] = args;
    if (typeof options === 'string') {
      options = {
        encoding: options
      };
    } else if (typeof options !== 'object') {
      throw new TypeError('Bad arguments');
    }
    const content = asar.extractFile(asarPath, filePath);
    if (options.encoding) {
      return content.toString(options.encoding);
    } else {
      return content;
    }
  };

  const { statSync } = fs;

  fs.statSync = function(...args) {
    const [path] = args;
    const [isAsar, asarPath, filePath] = splitPath(path);
    if (!isAsar) {
      return statSync.apply(this, args);
    }
    return asarStatsToFsStats(asar.statFile(asarPath, filePath));
  };

  const { realpathSync } = fs;

  fs.realpathSync = function(...args) {
    const [p] = args;
    const [isAsar, asarPath, fp] = splitPath(p);
    let filePath = fp;
    if (!isAsar) {
      return realpathSync.apply(this, args);
    }
    const stat = asar.statFile(asarPath, filePath);
    if (stat.link) {
      filePath = stat.link;
    }

    return path.join(realpathSync(asarPath), filePath);
  };

  const { readdir } = fs;
  fs.readdir = function(...args) {
    const [path, callback] = args;
    const [isAsar, asarPath, filePath] = splitPath(path);
    if (!isAsar) {
      return readdir.apply(this, args);
    }
    const archive = getOrCreateArchive(asarPath);
    if (!archive) {
      return invalidArchiveError(asarPath, callback);
    }
    const files = archive.readdir(filePath);
    if (!files) {
      return notFoundError(asarPath, filePath, callback);
    }
    return process.nextTick(function() {
      return callback(null, files);
    });
  };

  const { readdirSync } = fs;
  fs.readdirSync = function(...args) {
    const [path] = args;
    const [isAsar, asarPath, filePath] = splitPath(path);

    if (!isAsar) {
      return readdirSync.apply(this, args);
    }
    const archive = getOrCreateArchive(asarPath);
    if (!archive) {
      invalidArchiveError(asarPath);
      return;
    }
    const files = archive.readdir(filePath);
    if (!files) {
      notFoundError(asarPath, filePath);
      return;
    }
    return files;
  };
}.call(this));
