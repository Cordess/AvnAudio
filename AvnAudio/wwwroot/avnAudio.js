// MediaRecorder class required across methods.
var avnAudioRecorder;
var avnMediaStream;

// Stop Recording
export function stopRecording() {
    console.log("stopRecording called");
    // Make sure we have a MediaRecorder object
    if (avnAudioRecorder == null) {
        console.log("No recorder to stop");
        return;
    }
    // stop and clean up
    avnAudioRecorder.stop();
    avnAudioRecorder.dataavailable = null;
    avnAudioRecorder = null;

    // Stop all media tracks
    if (avnMediaStream) {
        avnMediaStream.getTracks().forEach(track => {
            console.log("Stopping track:", track.label);
            track.stop();
        });
        avnMediaStream = null;
    }
}

// Start recording
export async function startRecording(dotNetObject, deviceId, sampleRate,
    channels, timeSlice) {

    try {
        console.log("startRecording called with:", { deviceId, sampleRate, channels, timeSlice });

        // Passed to getUserMedia
        const constraints = {
            audio: {
                deviceId: deviceId ? { exact: deviceId } : true,
                channelCount: channels,
                sampleRate: { ideal: sampleRate },
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            },
        };

        console.log("Requesting audio with constraints:", constraints);

        // Check supported MIME types
        const mimeTypes = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/mp4'
        ];

        let selectedMimeType = 'audio/webm';
        for (const mimeType of mimeTypes) {
            if (MediaRecorder.isTypeSupported(mimeType)) {
                selectedMimeType = mimeType;
                console.log("Using MIME type:", mimeType);
                break;
            }
        }

        // passed to MediaRecorder constructor
        const options = {
            mimeType: selectedMimeType,
            audioBitsPerSecond: 128000  // 128 kbps - good quality for audio
        };

        // boolean set when recording has been stopped,
        // but there is still data to process
        var stopped = false;

        // First we need to retrieve the device
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        avnMediaStream = stream;

        console.log("Got media stream:", stream);

        // Check if we have audio tracks
        const audioTracks = stream.getAudioTracks();
        console.log("Audio tracks:", audioTracks);

        if (audioTracks.length === 0) {
            console.error("No audio tracks in stream!");
            dotNetObject.invokeMethodAsync("StatusChanged", "Error: No audio tracks found");
            return;
        }

        // Log track settings
        const trackSettings = audioTracks[0].getSettings();
        console.log("Audio track settings:", trackSettings);
        console.log("Track enabled:", audioTracks[0].enabled);
        console.log("Track muted:", audioTracks[0].muted);
        console.log("Track readyState:", audioTracks[0].readyState);

        {
            let recorder = new MediaRecorder(stream, options);
            if (recorder == null) {
                console.log("recorder is null");
                return;
            }

            console.log("MediaRecorder created, state:", recorder.state);
            console.log("MediaRecorder mimeType:", recorder.mimeType);

            // Handle the stop event
            recorder.addEventListener("stop", (e) => {
                console.log("Recording stopped event fired");
                // We've stopped recording,
                // but there is still data to process.
                // Set this flag
                stopped = true;
            });

            // Handle the start event
            recorder.addEventListener("start", (e) => {
                console.log("Recording started event fired");
            });

            // Handle the dataavailable event
            recorder.addEventListener('dataavailable', function (e) {
                console.log("Data available event fired, blob size:", e.data.size, "bytes, type:", e.data.type);

                // Check if there's actually data
                if (e.data.size === 0) {
                    console.warn("Received empty data blob!");
                    return;
                }

                // we have a buffer!!
                try {
                    // convert it to a base 64 string
                    var reader = new window.FileReader();
                    reader.onloadend = function () {
                        const arrayBuffer = reader.result;
                        const uint8Array = new Uint8Array(arrayBuffer);
                        console.log("ArrayBuffer size:", arrayBuffer.byteLength);
                        console.log("First 20 bytes:", Array.from(uint8Array.slice(0, 20)));

                        var base64String = btoa(String.fromCharCode.apply(null, uint8Array));
                        console.log("Sending base64 data to .NET, length:", base64String.length);

                        // Send the buffer up to the AvnAudio component
                        dotNetObject.invokeMethodAsync("DataAvailable", base64String);

                        // If we've stopped, tell the component
                        if (stopped) {
                            console.log("Calling RecordingStoppedCallback");
                            dotNetObject.invokeMethodAsync("RecordingStoppedCallback");
                        }
                    }
                    reader.onerror = function(error) {
                        console.error("FileReader error:", error);
                    };
                    reader.readAsArrayBuffer(e.data);
                }
                catch (err) {
                    console.error("Error processing audio data:", err);
                }

            });

                    // Handle errors
                    recorder.addEventListener("error", (e) => {
                        console.error("MediaRecorder error:", e);
                        dotNetObject.invokeMethodAsync("StatusChanged", "Recording error: " + e.error);
                    });

                    // Set this global variable
                    avnAudioRecorder = recorder;

                    // Start the recorder with the timeslice MS value
                    console.log("Starting recorder with timeslice:", timeSlice, "ms");
                    recorder.start(timeSlice);

                    console.log("Recorder state after start:", recorder.state);

                    // Tell the component we've started
                    dotNetObject.invokeMethodAsync("RecordingStartedCallback");
                }
            } catch (err) {
                console.error("Error starting recording:", err);
                dotNetObject.invokeMethodAsync("StatusChanged", "Error: " + err.message);
            }
}

// enumerate audio devices
export function enumerateAudioDevices(dotNetObject) {

    // Ensure the browser supports AudioContext
    if (!window.AudioContext) {
        if (!window.webkitAudioContext) {
            dotNetObject.invokeMethodAsync("StatusChanged", "Your browser does not support AudioContext.");
            return;
        }
        window.AudioContext = window.webkitAudioContext;
    }

    // Query the media devices
    if (window.AudioContext) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            // Make sure we CAN
            dotNetObject.invokeMethodAsync("StatusChanged", "enumerateDevices() not supported.");
            return;
        }

        // try using getUserMedia, which doesn't always work
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then(function (stream) {
                navigator.mediaDevices.enumerateDevices({ audio: true, video: false })
                    .then(function (devices) {
                        if (devices == null || devices.length == 0) {
                            dotNetObject.invokeMethodAsync("StatusChanged", "no devices found");
                            return;
                        }
                        // Call the .NET reference passing the array of devices
                        dotNetObject.invokeMethodAsync("AvailableAudioDevices", devices);
                        return;
                    })
                    .catch(function (err) {
                        dotNetObject.invokeMethodAsync("StatusChanged", err.name + ": " + err.message);
                        return;
                    });
            })
            .catch(function (err) {
                dotNetObject.invokeMethodAsync("StatusChanged", err.name + ": " + err.message);
                return;
            });

        // also try going straight to enumerateDevices
        navigator.mediaDevices.enumerateDevices({ audio: true, video: false })
            .then(function (devices) {
                if (devices == null || devices.length == 0) {
                    dotNetObject.invokeMethodAsync("StatusChanged", "no devices found");
                    return;
                }
                // Call the .NET reference passing the array of devices
                dotNetObject.invokeMethodAsync("AvailableAudioDevices", devices);
            })
            .catch(function (err) {
                dotNetObject.invokeMethodAsync("StatusChanged", err.name + ": " + err.message);
            });
    }
}

