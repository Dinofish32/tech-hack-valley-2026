// wasapi_capture.cpp
// Captures audio output from a specific Windows process using the WASAPI
// Application Loopback API (Windows 10 build 20348+ / Windows 11).
// Writes interleaved float32 stereo PCM frames to stdout.
// Usage: wasapi_capture.exe <PID>

#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <audioclient.h>
#include <mmdeviceapi.h>
#include <wrl/client.h>
#include <wrl/implements.h>
#include <fcntl.h>
#include <io.h>
#include <cstdio>
#include <cstdlib>
#include <cstdint>
#include <cstring>

// ---------------------------------------------------------------------------
// Fallback definitions for the Application Loopback API.
// These are in <audioclientactivationparams.h> (Windows 11 SDK 10.0.20348+).
// We define them manually so the file compiles on any SDK that has the runtime
// support (which all Windows 11 and late Windows 10 machines do).
// ---------------------------------------------------------------------------
#ifndef AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK

#define VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK L"VAD\\Process_Loopback"

enum AUDIOCLIENT_ACTIVATION_TYPE {
    AUDIOCLIENT_ACTIVATION_TYPE_DEFAULT          = 0,
    AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK = 1,
};

enum PROCESS_LOOPBACK_MODE {
    PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE = 0,
    PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE = 1,
};

struct AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS {
    DWORD               TargetProcessId;
    PROCESS_LOOPBACK_MODE ProcessLoopbackMode;
};

struct AUDIOCLIENT_ACTIVATION_PARAMS {
    AUDIOCLIENT_ACTIVATION_TYPE ActivationType;
    union {
        AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS ProcessLoopbackParams;
    };
};

#endif // AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK

using namespace Microsoft::WRL;

// ---------------------------------------------------------------------------
// COM completion handler for ActivateAudioInterfaceAsync
// ---------------------------------------------------------------------------
class CompletionHandler final : public RuntimeClass<
    RuntimeClassFlags<ClassicCom>,
    FtmBase,
    IActivateAudioInterfaceCompletionHandler>
{
public:
    HANDLE               hDone;
    HRESULT              hrResult = E_FAIL;
    ComPtr<IAudioClient> audioClient;

    CompletionHandler()  { hDone = CreateEventW(nullptr, FALSE, FALSE, nullptr); }
    ~CompletionHandler() { CloseHandle(hDone); }

    STDMETHOD(ActivateCompleted)(IActivateAudioInterfaceAsyncOperation* op) override {
        HRESULT hrOp;
        ComPtr<IUnknown> punk;
        hrResult = op->GetActivateResult(&hrOp, &punk);
        if (SUCCEEDED(hrResult) && SUCCEEDED(hrOp))
            punk.As(&audioClient);
        SetEvent(hDone);
        return S_OK;
    }
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
static void die(const char* msg, HRESULT hr = 0) {
    if (hr) fprintf(stderr, "[wasapi_capture] ERROR: %s (hr=0x%08X)\n", msg, (unsigned)hr);
    else    fprintf(stderr, "[wasapi_capture] ERROR: %s\n", msg);
    fflush(stderr);
    exit(1);
}

static inline void writeFrame(float l, float r) {
    float lr[2] = { l, r };
    fwrite(lr, sizeof(float), 2, stdout);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
int wmain(int argc, wchar_t* argv[]) {
    if (argc < 2) die("Usage: wasapi_capture.exe <PID>");

    DWORD pid = (DWORD)_wtol(argv[1]);
    if (!pid) die("Invalid PID — must be a non-zero integer");

    // Binary stdout so Node.js gets raw bytes
    _setmode(_fileno(stdout), _O_BINARY);

    // MTA is required for ActivateAudioInterfaceAsync
    HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    if (FAILED(hr)) die("CoInitializeEx", hr);

    // ------------------------------------------------------------------
    // Build process-loopback activation parameters
    // ------------------------------------------------------------------
    AUDIOCLIENT_ACTIVATION_PARAMS params{};
    params.ActivationType                            = AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK;
    params.ProcessLoopbackParams.TargetProcessId     = pid;
    params.ProcessLoopbackParams.ProcessLoopbackMode = PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE;

    PROPVARIANT pv{};
    pv.vt             = VT_BLOB;
    pv.blob.cbSize    = sizeof(params);
    pv.blob.pBlobData = reinterpret_cast<BYTE*>(&params);

    auto handler = Make<CompletionHandler>();
    ComPtr<IActivateAudioInterfaceAsyncOperation> asyncOp;

    hr = ActivateAudioInterfaceAsync(
        VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
        __uuidof(IAudioClient),
        &pv,
        handler.Get(),
        &asyncOp
    );
    if (FAILED(hr)) die("ActivateAudioInterfaceAsync", hr);

    if (WaitForSingleObject(handler->hDone, 5000) != WAIT_OBJECT_0)
        die("Activation timed out (5 s) — is the process running and producing audio?");

    if (FAILED(handler->hrResult) || !handler->audioClient)
        die("Activation failed", handler->hrResult);

    IAudioClient* client = handler->audioClient.Get();

    // ------------------------------------------------------------------
    // The Application Loopback virtual device does not support GetMixFormat.
    // Use a standard float32 stereo 48 kHz format — Windows uses this
    // internally and it is always valid for process loopback capture.
    // ------------------------------------------------------------------
    WAVEFORMATEX wfx = {};
    wfx.wFormatTag      = WAVE_FORMAT_IEEE_FLOAT;
    wfx.nChannels       = 2;
    wfx.nSamplesPerSec  = 48000;
    wfx.wBitsPerSample  = 32;
    wfx.nBlockAlign     = wfx.nChannels * wfx.wBitsPerSample / 8;
    wfx.nAvgBytesPerSec = wfx.nSamplesPerSec * wfx.nBlockAlign;
    wfx.cbSize          = 0;

    fprintf(stderr, "FORMAT:%u:%u:%u\n", wfx.nSamplesPerSec, wfx.nChannels, wfx.wBitsPerSample);
    fflush(stderr);

    // ------------------------------------------------------------------
    // Initialize IAudioClient for loopback capture (event-driven, 20 ms)
    // ------------------------------------------------------------------
    hr = client->Initialize(
        AUDCLNT_SHAREMODE_SHARED,
        AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
        200000,   // 20 ms in 100-ns units
        0,
        &wfx,
        nullptr
    );
    if (FAILED(hr)) die("IAudioClient::Initialize", hr);

    HANDLE hEvent = CreateEventW(nullptr, FALSE, FALSE, nullptr);
    hr = client->SetEventHandle(hEvent);
    if (FAILED(hr)) die("SetEventHandle", hr);

    ComPtr<IAudioCaptureClient> capture;
    hr = client->GetService(__uuidof(IAudioCaptureClient), &capture);
    if (FAILED(hr)) die("GetService(IAudioCaptureClient)", hr);

    hr = client->Start();
    if (FAILED(hr)) die("IAudioClient::Start", hr);

    fprintf(stderr, "[wasapi_capture] Streaming PID %lu @ 48000 Hz stereo float32\n", pid);
    fflush(stderr);

    // ------------------------------------------------------------------
    // Capture loop — always float32 stereo, write L+R pairs to stdout
    // ------------------------------------------------------------------
    static const float silence[2] = { 0.0f, 0.0f };

    while (true) {
        DWORD wait = WaitForSingleObject(hEvent, 200);
        if (wait == WAIT_FAILED || wait == WAIT_ABANDONED) break;

        UINT32 packetSize = 0;
        while (SUCCEEDED(capture->GetNextPacketSize(&packetSize)) && packetSize > 0) {
            BYTE*  data   = nullptr;
            UINT32 frames = 0;
            DWORD  flags  = 0;

            hr = capture->GetBuffer(&data, &frames, &flags, nullptr, nullptr);
            if (FAILED(hr)) goto done;

            if (flags & AUDCLNT_BUFFERFLAGS_SILENT) {
                for (UINT32 i = 0; i < frames; i++)
                    fwrite(silence, sizeof(float), 2, stdout);
            } else {
                auto* s = reinterpret_cast<float*>(data);
                for (UINT32 i = 0; i < frames; i++)
                    writeFrame(s[i * 2], s[i * 2 + 1]);
            }

            capture->ReleaseBuffer(frames);
        }
        fflush(stdout);
    }

done:
    client->Stop();
    CloseHandle(hEvent);
    CoUninitialize();
    return 0;
}
