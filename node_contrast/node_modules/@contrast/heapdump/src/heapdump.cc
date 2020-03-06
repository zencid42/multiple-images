// Copyright (c) 2012, Ben Noordhuis <info@bnoordhuis.nl>
// Ported to N-API by Contrast Security
//
// Permission to use, copy, modify, and/or distribute this software for any
// purpose with or without fee is hereby granted, provided that the above
// copyright notice and this permission notice appear in all copies.
//
// THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
// WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
// MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
// ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
// WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
// ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
// OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

#include <stdio.h>
#include <stdarg.h>
#include <stdlib.h>
#include <assert.h>
#include <v8.h>
#include <v8-profiler.h>
#include <nan.h>
#include <node_api.h>

#ifdef _WIN32
#include "heapdump-win32.h"
#endif

// status checks for error are super common and repetetive.
#define CHECK_ERROR(_environment, _status, _error_str)                  \
    if ((_status) != napi_ok)                                           \
        napi_throw_error(_environment, nullptr, (_error_str));

class FileOutputStream : public v8::OutputStream {
 public:
  FileOutputStream(FILE* stream) : stream_(stream) {}

  virtual int GetChunkSize() {
    return 65536;  // big chunks == faster
  }

  virtual void EndOfStream() {}

  virtual WriteResult WriteAsciiChunk(char* data, int size) {
    const size_t len = static_cast<size_t>(size);
    size_t off = 0;

    while (off < len && !feof(stream_) && !ferror(stream_))
      off += fwrite(data + off, 1, len - off, stream_);

    return off == len ? kContinue : kAbort;
  }

 private:
  FILE* stream_;
};

const v8::HeapSnapshot* TakeHeapSnapshot(v8::Isolate* isolate) {
    return isolate->GetHeapProfiler()->TakeHeapSnapshot();
}

static bool writeSnapshotToDisk(v8::Isolate* isolate, const char* filename) {
    FILE* fp = fopen(filename, "w");
    if (fp == NULL) return false;
    const v8::HeapSnapshot* const snap = TakeHeapSnapshot(isolate);
    FileOutputStream stream(fp);
    snap->Serialize(&stream, v8::HeapSnapshot::kJSON);
    fclose(fp);
    // Work around a deficiency in the API.  The HeapSnapshot object is const
    // but we cannot call HeapProfiler::DeleteAllHeapSnapshots() because that
    // invalidates _all_ snapshots, including those created by other tools.
    const_cast<v8::HeapSnapshot*>(snap)->Delete();
    return true;
}

/* param: filename (string: utf8) */
napi_value WriteSnapshot(napi_env env, napi_callback_info args) {
    napi_status status;
    char *buf = nullptr;
    size_t bufLength = 0;
    size_t bytesCopied = 0;
    napi_value null;

    napi_get_null(env, &null);

    size_t argc = 1;
    napi_value argv[1];

    status = napi_get_cb_info(env, args, &argc, argv, nullptr, nullptr);
    CHECK_ERROR(env, status, "Could not parse arguments to writeSnapshot");

    status = napi_get_value_string_utf8(env, argv[0], buf, bufLength, &bytesCopied);
    CHECK_ERROR(env, status, "Could not allocate memory for buffer.");

    bufLength = bytesCopied + 1;

    buf = static_cast<char *>(malloc(sizeof(char) * bufLength));
    if (buf == nullptr) {
        napi_throw_error(env,  nullptr, "Could not allocate memory");
    }
    status = napi_get_value_string_utf8(env, argv[0], buf, bufLength, &bytesCopied);
    CHECK_ERROR(env, status, "Unable to convert cstring back to napi.");

    writeSnapshotToDisk(v8::Isolate::GetCurrent(), buf);

    free(buf);
    
    return null;
}

napi_value Init(napi_env env, napi_value exports) {
    napi_status status;
    napi_value writeSnapshotCallback;

    status = napi_create_function(env, nullptr, 0, WriteSnapshot, nullptr, &writeSnapshotCallback);
    CHECK_ERROR(env, status, "Unable to wrap native writeSnapshot");

    status = napi_set_named_property(env, exports, "writeSnapshot", writeSnapshotCallback);
    CHECK_ERROR(env, status, "Cannot set property on exports");

    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
