let qrScanner = null;

let processingQR = false;

let currentCheckpoint = 1;


/* ==========================
   LOAD HUNT
========================== */

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


        if (result.finalStage) {

            document
                .getElementById(
                    "clueText"
                )
                .innerText =
                    "All five checkpoints are complete. Final stage coming next.";

            return;
        }


        document
            .getElementById(
                "teamName"
            )
            .innerText =
                result.team.name;


        currentCheckpoint =
            result.team.currentCheckpoint;


        document
            .getElementById(
                "checkpointNumber"
            )
            .innerText =
                currentCheckpoint;


        document
            .getElementById(
                "clueText"
            )
            .innerText =
                result.clue;


    } catch (error) {

        console.error(error);
    }
}


loadHunt();


/* ==========================
   OPEN SCANNER
========================== */

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


    processingQR = false;


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
                fps: 10,

                qrbox: {
                    width: 240,
                    height: 240
                }
            },

            onQRDetected,

            () => {}
        );


    } catch (error) {

        console.error(error);


        document
            .getElementById(
                "scannerStatus"
            )
            .innerText =
                "Could not open camera.";
    }
}


/* ==========================
   QR FOUND
========================== */

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

                    method: "POST",

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
                result.message
            );

            return;
        }


        showCheckpointSuccess(
            result
        );


    } catch (error) {

        console.error(error);


        showWrongQR(
            "Connection error. Try again."
        );
    }
}


/* ==========================
   VALID QR
========================== */

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
            `Checkpoint ${result.completedCheckpoint} Complete`;


    document
        .getElementById(
            "resultMessage"
        )
        .innerText =
            "The mark is valid. Your path continues.";


    document
        .getElementById(
            "nextClue"
        )
        .innerText =
            result.nextClue;


    const button =
        document.getElementById(
            "scanNextButton"
        );


    if (
        result.finalStage
    ) {

        button.innerText =
            "Continue to Final Stage";

    } else {

        button.innerText =
            "Scan Next";
    }
}


/* ==========================
   WRONG QR
========================== */

function showWrongQR(message) {

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


    document
        .getElementById(
            "resultTitle"
        )
        .innerText =
            "Wrong Path";


    document
        .getElementById(
            "resultMessage"
        )
        .innerText =
            message;


    document
        .getElementById(
            "nextClue"
        )
        .innerText =
            "Return to your current clue and keep searching.";


    const button =
        document.getElementById(
            "scanNextButton"
        );


    button.innerText =
        "Try Again";
}


/* ==========================
   CONTINUE
========================== */

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


/* ==========================
   CLOSE SCANNER
========================== */

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

        // Scanner may already
        // have stopped.
    }


    qrScanner = null;
}


/* ==========================
   EVENT RESET CHECK
========================== */

setInterval(
    async () => {

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
            }


        } catch (error) {
            // Retry next interval
        }

    },
    2500
);