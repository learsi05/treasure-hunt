let qrScanner = null;

let processingQR = false;

let currentStage = 1;


/* =====================================================
   LOAD CURRENT HUNT STATE
===================================================== */

async function loadHunt() {

    try {

        const response =
            await fetch(
                "/api/hunt-state",
                {
                    cache: "no-store"
                }
            );


        if (
            response.status === 401
        ) {

            window.location.replace(
                "./login.html"
            );

            return;
        }


        const result =
            await response.json();


        if (
            response.status === 409
        ) {

            window.location.replace(
                "./waiting.html"
            );

            return;
        }


        if (!response.ok) {

            alert(
                result.message ||
                "Could not load hunt."
            );

            return;
        }


        if (result.finished) {

            window.location.replace(
                "./finished.html"
            );

            return;
        }


        currentStage =
            result.team.currentStage;


        document
            .getElementById(
                "teamName"
            )
            .innerText =
                result.team.name;


        document
            .getElementById(
                "stageLabel"
            )
            .innerText =
                result.stageLabel;


        document
            .getElementById(
                "clueTitle"
            )
            .innerText =
                result.clueTitle;


        document
            .getElementById(
                "clueText"
            )
            .innerText =
                result.clue;


        document
            .getElementById(
                "scanButton"
            )
            .innerText =
                `📷 ${result.scanButton}`;


    } catch (error) {

        console.error(
            error
        );
    }
}


/* =====================================================
   CAMERA
===================================================== */

async function openScanner() {

    document
        .getElementById(
            "clueScreen"
        )
        .classList
        .add("hidden");


    document
        .getElementById(
            "resultScreen"
        )
        .classList
        .add("hidden");


    document
        .getElementById(
            "scannerScreen"
        )
        .classList
        .remove("hidden");


    processingQR =
        false;


    document
        .getElementById(
            "scannerStatus"
        )
        .innerText =
            "Point your camera at the QR code.";


    qrScanner =
        new Html5Qrcode(
            "qr-reader"
        );


    try {

        await qrScanner.start(

            {
                facingMode:
                    "environment"
            },

            {
                fps:
                    10,

                qrbox: {
                    width:
                        240,

                    height:
                        240
                }
            },

            onQRDetected,

            () => {}
        );


    } catch (error) {

        console.error(
            error
        );


        document
            .getElementById(
                "scannerStatus"
            )
            .innerText =
                "Could not open camera.";
    }
}


/* =====================================================
   QR DETECTED
===================================================== */

async function onQRDetected(
    decodedText
) {

    if (processingQR) {
        return;
    }


    processingQR =
        true;


    document
        .getElementById(
            "scannerStatus"
        )
        .innerText =
            "Checking QR...";


    try {

        await stopScanner();


        const response =
            await fetch(
                "/api/scan-qr",
                {

                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            qrCode:
                                decodedText
                        })

                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            showWrongQR(
                result
            );

            return;
        }


        if (result.finished) {

            window.location.replace(
                "./finished.html"
            );

            return;
        }


        showCheckpointSuccess(
            result
        );


    } catch (error) {

        console.error(
            error
        );


        showWrongQR({
            message:
                "Connection error. Please try again."
        });
    }
}


/* =====================================================
   CORRECT QR
===================================================== */

function showCheckpointSuccess(
    result
) {

    document
        .getElementById(
            "scannerScreen"
        )
        .classList
        .add("hidden");


    document
        .getElementById(
            "resultScreen"
        )
        .classList
        .remove("hidden");


    document
        .getElementById(
            "resultIcon"
        )
        .innerText =
            "✓";


    document
        .getElementById(
            "resultTitle"
        )
        .innerText =
            `${result.completedLabel} Complete`;


    document
        .getElementById(
            "resultMessage"
        )
        .innerText =
            result.finalStage
                ?
                "Your team-specific route is complete. The final checkpoint is now unlocked."
                :
                "Correct QR. Your next clue has been revealed.";


    document
        .getElementById(
            "nextClue"
        )
        .innerText =
            result.revealedClue;


    const button =
        document
            .getElementById(
                "scanNextButton"
            );


    button.innerText =
        result.finalStage
            ?
            "Continue to Final Checkpoint"
            :
            "Continue";
}


/* =====================================================
   WRONG QR
===================================================== */

function showWrongQR(result) {

    document
        .getElementById(
            "scannerScreen"
        )
        .classList
        .add("hidden");


    document
        .getElementById(
            "resultScreen"
        )
        .classList
        .remove("hidden");


    document
        .getElementById(
            "resultIcon"
        )
        .innerText =
            "✕";


    let title =
        "Wrong Path";


    if (
        result.code ===
        "FUTURE_CHECKPOINT"
    ) {

        title =
            "Checkpoint Locked";
    }


    if (
        result.code ===
        "FINAL_LOCKED"
    ) {

        title =
            "Final Checkpoint Locked";
    }


    if (
        result.code ===
        "OLD_CHECKPOINT"
    ) {

        title =
            "Already Completed";
    }


    document
        .getElementById(
            "resultTitle"
        )
        .innerText =
            title;


    document
        .getElementById(
            "resultMessage"
        )
        .innerText =
            result.message;


    document
        .getElementById(
            "nextClue"
        )
        .innerText =
            "Return to your current objective and continue searching.";


    document
        .getElementById(
            "scanNextButton"
        )
        .innerText =
            "Try Again";
}


/* =====================================================
   CONTINUE
===================================================== */

async function continueHunt() {

    await loadHunt();


    document
        .getElementById(
            "resultScreen"
        )
        .classList
        .add("hidden");


    document
        .getElementById(
            "clueScreen"
        )
        .classList
        .remove("hidden");
}


/* =====================================================
   STOP CAMERA
===================================================== */

async function closeScanner() {

    await stopScanner();


    document
        .getElementById(
            "scannerScreen"
        )
        .classList
        .add("hidden");


    document
        .getElementById(
            "clueScreen"
        )
        .classList
        .remove("hidden");
}


async function stopScanner() {

    if (!qrScanner) {
        return;
    }


    try {

        await qrScanner.stop();

        await qrScanner.clear();

    } catch (error) {

        // Already stopped.
    }


    qrScanner =
        null;
}


/* =====================================================
   EVENT RESET / SESSION CHECK
===================================================== */

async function checkSessionState() {

    if (processingQR) {
        return;
    }


    try {

        const response =
            await fetch(
                "/api/team-session",
                {
                    cache:
                        "no-store"
                }
            );


        if (
            response.status ===
            401
        ) {

            await stopScanner();


            window.location.replace(
                "./login.html"
            );

            return;
        }


        const result =
            await response.json();


        if (
            result.event &&
            result.event.status !==
            "running"
        ) {

            await stopScanner();


            window.location.replace(
                "./waiting.html"
            );
        }


    } catch (error) {

        // Try again later.
    }
}


loadHunt();


setInterval(
    checkSessionState,
    2500
);


document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.visibilityState ===
            "visible"
        ) {

            checkSessionState();
        }
    }
);