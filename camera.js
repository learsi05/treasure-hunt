let cameraStream = null;


const teamBadge =
    document.getElementById(
        "teamBadge"
    );


const cameraVideo =
    document.getElementById(
        "cameraVideo"
    );


const cameraPlaceholder =
    document.getElementById(
        "cameraPlaceholder"
    );


const cameraStatus =
    document.getElementById(
        "cameraStatus"
    );


const cameraMessage =
    document.getElementById(
        "cameraMessage"
    );


const checkButton =
    document.getElementById(
        "checkCameraButton"
    );


const continueButton =
    document.getElementById(
        "continueButton"
    );


// --------------------------------
// Verify team session on page load
// --------------------------------

async function verifySession() {

    try {

        const response =
            await fetch(
                "/api/team-session"
            );


        const result =
            await response.json();


        if (!response.ok) {

            window.location.href =
                "./login.html";

            return;
        }


        teamBadge.innerText =
            result.team.name;


    } catch (error) {

        console.error(error);

        window.location.href =
            "./login.html";
    }
}


verifySession();


// --------------------------------
// CAMERA CHECK
// --------------------------------

async function checkCamera() {

    cameraMessage.innerText = "";

    cameraMessage.className =
        "message";


    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        showCameraError(
            "Camera access is not supported by this browser."
        );

        return;
    }


    checkButton.disabled = true;

    checkButton.innerText =
        "Opening camera...";


    try {

        cameraStream =
            await navigator
                .mediaDevices
                .getUserMedia({

                    video: {
                        facingMode: {
                            ideal:
                                "environment"
                        }
                    },

                    audio: false
                });


        cameraVideo.srcObject =
            cameraStream;


        cameraVideo.style.display =
            "block";


        cameraPlaceholder.style.display =
            "none";


        cameraStatus.innerText =
            "✓ Camera Ready";


        cameraMessage.className =
            "message success";


        cameraMessage.innerText =
            "Camera access successful.";


        checkButton.style.display =
            "none";


        continueButton.style.display =
            "block";


    } catch (error) {

        console.error(error);


        if (
            error.name ===
            "NotAllowedError"
        ) {

            showCameraError(
                "Camera permission was denied. Allow camera access in your browser and try again."
            );

        } else if (
            error.name ===
            "NotFoundError"
        ) {

            showCameraError(
                "No camera was detected on this device."
            );

        } else {

            showCameraError(
                "Could not start the camera."
            );
        }


        checkButton.disabled =
            false;

        checkButton.innerText =
            "Try Camera Again";
    }
}


function showCameraError(text) {

    cameraStatus.innerText =
        "Camera Check Failed";


    cameraMessage.className =
        "message error";


    cameraMessage.innerText =
        text;
}


// --------------------------------
// NEXT PAGE
// --------------------------------

function continueToWaiting() {

    if (!cameraStream) {

        showCameraError(
            "Complete the camera check first."
        );

        return;
    }


    // Close preview before moving
    // to the next page.

    cameraStream
        .getTracks()
        .forEach(
            track =>
                track.stop()
        );


    window.location.href =
        "./waiting.html";
}