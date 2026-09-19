let qrScanner = null;

let processingQR = false;

let currentStage = 1;

let currentAssistance = null;

let assistanceTimer = null;


/*
 * We use the server time returned by
 * the backend as the reference clock.
 *
 * performance.now() is monotonic, so
 * changing the phone's clock will not
 * unlock Hint / Answer early.
 */
let serverEpochAtSync = null;

let performanceAtSync = null;


/* =========================================================
   SERVER CLOCK
========================================================= */

function syncServerClock(
    serverNow
) {

    const parsed =
        Date.parse(
            serverNow || ""
        );


    if (
        !Number.isFinite(
            parsed
        )
    ) {

        return;
    }


    serverEpochAtSync =
        parsed;


    performanceAtSync =
        performance.now();
}


function estimatedServerNowMs() {

    if (
        Number.isFinite(
            serverEpochAtSync
        ) &&
        Number.isFinite(
            performanceAtSync
        )
    ) {

        return (
            serverEpochAtSync
            +
            (
                performance.now()
                -
                performanceAtSync
            )
        );
    }


    return Date.now();
}


/*
 * Used when the server rejects an
 * unlock attempt and tells us exactly
 * how many seconds remain.
 */

function syncServerClockFromRemaining(
    unlockAt,
    remainingSeconds
) {

    const unlockMs =
        Date.parse(
            unlockAt || ""
        );


    const remaining =
        Number(
            remainingSeconds
        );


    if (
        !Number.isFinite(
            unlockMs
        ) ||
        !Number.isFinite(
            remaining
        )
    ) {

        return;
    }


    serverEpochAtSync =
        unlockMs
        -
        (
            Math.max(
                0,
                remaining
            )
            *
            1000
        );


    performanceAtSync =
        performance.now();
}


/* =========================================================
   COUNTDOWN HELPERS
========================================================= */

function formatCountdown(
    totalSeconds
) {

    const seconds =
        Math.max(
            0,
            Math.ceil(
                Number(
                    totalSeconds
                ) || 0
            )
        );


    const minutes =
        Math.floor(
            seconds / 60
        );


    const remainder =
        seconds % 60;


    return (

        String(
            minutes
        )
            .padStart(
                2,
                "0"
            )

        +

        ":"

        +

        String(
            remainder
        )
            .padStart(
                2,
                "0"
            )

    );
}


function remainingUntil(
    unlockAt
) {

    const unlockMs =
        Date.parse(
            unlockAt || ""
        );


    if (
        !Number.isFinite(
            unlockMs
        )
    ) {

        return null;
    }


    return Math.max(

        0,

        Math.ceil(
            (
                unlockMs
                -
                estimatedServerNowMs()
            )
            /
            1000
        )

    );
}


/* =========================================================
   CLUE IMAGE
========================================================= */

function setClueImage(
    wrapperId,
    imageId,
    imageUrl
) {

    const wrapper =
        document.getElementById(
            wrapperId
        );


    const image =
        document.getElementById(
            imageId
        );


    if (
        !wrapper ||
        !image
    ) {

        return;
    }


    if (imageUrl) {

        image.src =
            imageUrl;


        wrapper
            .classList
            .remove(
                "hidden"
            );


    } else {

        image.removeAttribute(
            "src"
        );


        wrapper
            .classList
            .add(
                "hidden"
            );
    }
}


/* =========================================================
   ASSISTANCE UI
   HINT + ANSWER
========================================================= */

function assistancePrefixForMount(
    mountId
) {

    return (
        mountId ===
        "resultAssistanceMount"
            ?
            "result"
            :
            "clue"
    );
}


function renderAssistance(
    mountId,
    assistance
) {

    const mount =
        document.getElementById(
            mountId
        );


    if (!mount) {

        return;
    }


    mount.innerHTML =
        "";


    /*
     * Nothing is shown when the
     * admin did not configure a Hint.
     */

    if (
        !assistance ||
        !assistance.hasHint
    ) {

        return;
    }


    const prefix =
        assistancePrefixForMount(
            mountId
        );


    /* =====================================================
       HINT STATE
    ===================================================== */

    const hintRemaining =
        assistance.hintRevealed
            ?
            0
            :
            remainingUntil(
                assistance
                    .hintUnlockAt
            );


    const hintUnlocked =

        assistance.hintRevealed

        ||

        assistance.hintUnlocked

        ||

        hintRemaining === 0;


    let html = `

        <div
            class="
                assistance-card
                hint-card
            "
        >

            <div class="assistance-heading">

                <div>

                    <span class="assistance-icon">
                        💡
                    </span>

                    <strong>
                        Hint
                    </strong>

                </div>


                <span class="assistance-badge">
                    OPTIONAL HELP
                </span>

            </div>

    `;


    /*
     * HINT ALREADY OPENED
     */

    if (
        assistance.hintRevealed
    ) {

        html += `

            <div
                class="
                    revealed-assistance
                    hint-revealed
                "
            >

                <small>
                    HINT REVEALED
                </small>

                <p>
                    ${
                        escapeHTML(
                            assistance.hintText ||
                            ""
                        )
                    }
                </p>

            </div>

        `;


    } else {

        /*
         * HINT LOCKED / READY
         */

        html += `

            <p class="assistance-description">

                Need help?

                The hint unlocks 5 minutes
                after this clue is revealed.

            </p>


            <button
                id="${prefix}HintButton"

                class="
                    assistance-button
                    hint-button
                "

                onclick="
                    revealHint(
                        '${mountId}'
                    )
                "

                ${
                    hintUnlocked
                        ?
                        ""
                        :
                        "disabled"
                }
            >

                ${
                    hintUnlocked

                        ?

                        "💡 View Hint"

                        :

                        `🔒 Hint locked — ${
                            formatCountdown(
                                hintRemaining
                            )
                        }`
                }

            </button>


            <div
                id="${prefix}HintCountdown"

                class="
                    assistance-countdown
                    ${
                        hintUnlocked
                            ?
                            "ready"
                            :
                            ""
                    }
                "
            >

                ${
                    hintUnlocked

                        ?

                        "Hint is now available."

                        :

                        `Available in ${
                            formatCountdown(
                                hintRemaining
                            )
                        }`
                }

            </div>

        `;
    }


    html += `

        </div>

    `;


    /* =====================================================
       ANSWER STATE
    =====================================================

       Answer does NOT appear until
       Hint has actually been opened.
    ===================================================== */

    if (
        assistance.hintRevealed &&
        assistance.hasAnswer
    ) {

        const answerRemaining =
            assistance.answerRevealed
                ?
                0
                :
                remainingUntil(
                    assistance
                        .answerUnlockAt
                );


        const answerUnlocked =

            assistance.answerRevealed

            ||

            assistance.answerUnlocked

            ||

            answerRemaining === 0;


        html += `

            <div
                class="
                    assistance-card
                    answer-card
                "
            >

                <div class="assistance-heading">

                    <div>

                        <span class="assistance-icon">
                            🔑
                        </span>

                        <strong>
                            Answer
                        </strong>

                    </div>


                    <span
                        class="
                            assistance-badge
                            answer-badge
                        "
                    >
                        FINAL HELP
                    </span>

                </div>

        `;


        /*
         * ANSWER ALREADY OPENED
         */

        if (
            assistance.answerRevealed
        ) {

            html += `

                <div
                    class="
                        revealed-assistance
                        answer-revealed
                    "
                >

                    <small>
                        ANSWER REVEALED
                    </small>

                    <p>
                        ${
                            escapeHTML(
                                assistance.answerText ||
                                ""
                            )
                        }
                    </p>

                </div>

            `;


        } else {

            /*
             * ANSWER LOCKED / READY
             */

            html += `

                <p class="assistance-description">

                    The answer unlocks
                    10 minutes after your team
                    opens the Hint.

                </p>


                <button
                    id="${prefix}AnswerButton"

                    class="
                        assistance-button
                        answer-button
                    "

                    onclick="
                        revealAnswer(
                            '${mountId}'
                        )
                    "

                    ${
                        answerUnlocked
                            ?
                            ""
                            :
                            "disabled"
                    }
                >

                    ${
                        answerUnlocked

                            ?

                            "🔑 Show Answer"

                            :

                            `🔒 Answer locked — ${
                                formatCountdown(
                                    answerRemaining
                                )
                            }`
                    }

                </button>


                <div
                    id="${prefix}AnswerCountdown"

                    class="
                        assistance-countdown
                        ${
                            answerUnlocked
                                ?
                                "ready"
                                :
                                ""
                        }
                    "
                >

                    ${
                        answerUnlocked

                            ?

                            "Answer is now available."

                            :

                            `Available in ${
                                formatCountdown(
                                    answerRemaining
                                )
                            }`
                    }

                </div>

            `;
        }


        html += `

            </div>

        `;
    }


    /* =====================================================
       STATUS MESSAGE
    ===================================================== */

    html += `

        <p
            id="${prefix}AssistanceStatus"
            class="assistance-status"
        ></p>

    `;


    mount.innerHTML =
        html;
}


/* =========================================================
   RENDER ASSISTANCE ON BOTH POSSIBLE SCREENS
========================================================= */

function renderCurrentAssistanceEverywhere() {

    /*
     * Normal clue screen
     */

    renderAssistance(
        "clueAssistanceMount",
        currentAssistance
    );


    /*
     * Result screen only when
     * a successful clue is being shown.
     */

    const resultScreen =
        document.getElementById(
            "resultScreen"
        );


    const resultClueArea =
        document.getElementById(
            "resultClueArea"
        );


    if (
        resultScreen &&
        resultClueArea &&
        !resultScreen
            .classList
            .contains(
                "hidden"
            ) &&
        !resultClueArea
            .classList
            .contains(
                "hidden"
            )
    ) {

        renderAssistance(
            "resultAssistanceMount",
            currentAssistance
        );
    }
}


/* =========================================================
   LIVE COUNTDOWN
========================================================= */

function updateAssistanceCountdowns() {

    if (
        !currentAssistance ||
        !currentAssistance.hasHint
    ) {

        return;
    }


    const mounts = [

        "clueAssistanceMount",

        "resultAssistanceMount"

    ];


    for (
        const mountId
        of mounts
    ) {

        const mount =
            document.getElementById(
                mountId
            );


        if (
            !mount ||
            !mount.innerHTML.trim()
        ) {

            continue;
        }


        const prefix =
            assistancePrefixForMount(
                mountId
            );


        /* =================================================
           HINT COUNTDOWN
        ================================================= */

        if (
            !currentAssistance
                .hintRevealed
        ) {

            const remaining =
                remainingUntil(
                    currentAssistance
                        .hintUnlockAt
                );


            const button =
                document.getElementById(
                    `${prefix}HintButton`
                );


            const countdown =
                document.getElementById(
                    `${prefix}HintCountdown`
                );


            if (
                button &&
                remaining !== null
            ) {

                if (
                    remaining <= 0
                ) {

                    button.disabled =
                        false;


                    button.innerText =
                        "💡 View Hint";


                    if (countdown) {

                        countdown.innerText =
                            "Hint is now available.";


                        countdown
                            .classList
                            .add(
                                "ready"
                            );
                    }


                } else {

                    button.disabled =
                        true;


                    button.innerText =
                        `🔒 Hint locked — ${
                            formatCountdown(
                                remaining
                            )
                        }`;


                    if (countdown) {

                        countdown.innerText =
                            `Available in ${
                                formatCountdown(
                                    remaining
                                )
                            }`;


                        countdown
                            .classList
                            .remove(
                                "ready"
                            );
                    }
                }
            }
        }


        /* =================================================
           ANSWER COUNTDOWN
        ================================================= */

        if (
            currentAssistance
                .hintRevealed &&
            currentAssistance
                .hasAnswer &&
            !currentAssistance
                .answerRevealed
        ) {

            const remaining =
                remainingUntil(
                    currentAssistance
                        .answerUnlockAt
                );


            const button =
                document.getElementById(
                    `${prefix}AnswerButton`
                );


            const countdown =
                document.getElementById(
                    `${prefix}AnswerCountdown`
                );


            if (
                button &&
                remaining !== null
            ) {

                if (
                    remaining <= 0
                ) {

                    button.disabled =
                        false;


                    button.innerText =
                        "🔑 Show Answer";


                    if (countdown) {

                        countdown.innerText =
                            "Answer is now available.";


                        countdown
                            .classList
                            .add(
                                "ready"
                            );
                    }


                } else {

                    button.disabled =
                        true;


                    button.innerText =
                        `🔒 Answer locked — ${
                            formatCountdown(
                                remaining
                            )
                        }`;


                    if (countdown) {

                        countdown.innerText =
                            `Available in ${
                                formatCountdown(
                                    remaining
                                )
                            }`;


                        countdown
                            .classList
                            .remove(
                                "ready"
                            );
                    }
                }
            }
        }
    }
}


/* =========================================================
   ASSISTANCE STATUS MESSAGE
========================================================= */

function setAssistanceStatus(
    mountId,
    text,
    isError = false
) {

    const prefix =
        assistancePrefixForMount(
            mountId
        );


    const status =
        document.getElementById(
            `${prefix}AssistanceStatus`
        );


    if (!status) {

        return;
    }


    status.innerText =
        text || "";


    status
        .classList
        .toggle(
            "error",
            Boolean(
                isError
            )
        );


    status
        .classList
        .toggle(
            "success",
            Boolean(text) &&
            !isError
        );
}


/* =========================================================
   REVEAL HINT
========================================================= */

async function revealHint(
    mountId
) {

    const prefix =
        assistancePrefixForMount(
            mountId
        );


    const button =
        document.getElementById(
            `${prefix}HintButton`
        );


    if (button) {

        button.disabled =
            true;


        button.innerText =
            "Checking hint...";
    }


    setAssistanceStatus(
        mountId,
        ""
    );


    try {

        const response =
            await fetch(
                "/api/hunt-state",
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            action:
                                "reveal_hint"

                        })

                }
            );


        const result =
            await response.json();


        /* ---------------------------------------------
           SESSION LOST
        --------------------------------------------- */

        if (
            response.status ===
            401
        ) {

            window.location.replace(
                "./login.html"
            );

            return;
        }


        /* ---------------------------------------------
           EVENT RESET / STOPPED
        --------------------------------------------- */

        if (
            response.status ===
            409
        ) {

            window.location.replace(
                "./waiting.html"
            );

            return;
        }


        /* ---------------------------------------------
           SERVER SAYS STILL LOCKED
        --------------------------------------------- */

        if (!response.ok) {

            if (
                result.code ===
                "HINT_LOCKED"
            ) {

                if (
                    result.unlockAt
                ) {

                    currentAssistance
                        .hintUnlockAt =
                            result.unlockAt;
                }


                syncServerClockFromRemaining(

                    result.unlockAt,

                    result.remainingSeconds

                );


                renderCurrentAssistanceEverywhere();


                setAssistanceStatus(

                    mountId,

                    `Hint is still locked for ${
                        formatCountdown(
                            result.remainingSeconds
                        )
                    }.`,

                    true

                );


                return;
            }


            renderCurrentAssistanceEverywhere();


            setAssistanceStatus(

                mountId,

                result.message ||
                "Could not reveal hint.",

                true

            );


            return;
        }


        /* =================================================
           HINT SUCCESSFULLY REVEALED
        ================================================= */

        currentAssistance = {

            ...(
                currentAssistance ||
                {}
            ),


            hasHint:
                true,


            hintUnlocked:
                true,


            hintRevealed:
                true,


            hintRevealedAt:
                result.hintRevealedAt ||
                null,


            hintText:
                result.hint ||
                "",


            hasAnswer:
                Boolean(
                    result.hasAnswer
                ),


            answerUnlockAt:
                result.answerUnlockAt ||
                null,


            answerRemainingSeconds:
                result.answerRemainingSeconds ??
                null,


            answerUnlocked:
                false,


            answerRevealed:
                false,


            answerRevealedAt:
                null,


            answerText:
                null

        };


        /*
         * Synchronize with server's
         * 10-minute Answer timer.
         */

        if (
            result.answerUnlockAt &&
            result.answerRemainingSeconds !==
            null &&
            result.answerRemainingSeconds !==
            undefined
        ) {

            syncServerClockFromRemaining(

                result.answerUnlockAt,

                result.answerRemainingSeconds

            );
        }


        renderCurrentAssistanceEverywhere();


        setAssistanceStatus(

            mountId,

            "Hint revealed.",

            false

        );


    } catch (error) {

        console.error(
            "REVEAL HINT ERROR:",
            error
        );


        renderCurrentAssistanceEverywhere();


        setAssistanceStatus(

            mountId,

            "Connection error. Please try again.",

            true

        );
    }
}


/* =========================================================
   REVEAL ANSWER
========================================================= */

async function revealAnswer(
    mountId
) {

    const prefix =
        assistancePrefixForMount(
            mountId
        );


    const button =
        document.getElementById(
            `${prefix}AnswerButton`
        );


    if (button) {

        button.disabled =
            true;


        button.innerText =
            "Checking answer...";
    }


    setAssistanceStatus(
        mountId,
        ""
    );


    try {

        const response =
            await fetch(
                "/api/hunt-state",
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            action:
                                "reveal_answer"

                        })

                }
            );


        const result =
            await response.json();


        if (
            response.status ===
            401
        ) {

            window.location.replace(
                "./login.html"
            );

            return;
        }


        if (
            response.status ===
            409
        ) {

            window.location.replace(
                "./waiting.html"
            );

            return;
        }


        /* ---------------------------------------------
           ANSWER STILL LOCKED
        --------------------------------------------- */

        if (!response.ok) {

            if (
                result.code ===
                "ANSWER_LOCKED"
            ) {

                if (
                    result.unlockAt
                ) {

                    currentAssistance
                        .answerUnlockAt =
                            result.unlockAt;
                }


                syncServerClockFromRemaining(

                    result.unlockAt,

                    result.remainingSeconds

                );


                renderCurrentAssistanceEverywhere();


                setAssistanceStatus(

                    mountId,

                    `Answer is still locked for ${
                        formatCountdown(
                            result.remainingSeconds
                        )
                    }.`,

                    true

                );


                return;
            }


            renderCurrentAssistanceEverywhere();


            setAssistanceStatus(

                mountId,

                result.message ||
                "Could not reveal answer.",

                true

            );


            return;
        }


        /* =================================================
           ANSWER REVEALED
        ================================================= */

        currentAssistance = {

            ...(
                currentAssistance ||
                {}
            ),


            answerUnlocked:
                true,


            answerRevealed:
                true,


            answerRevealedAt:
                result.answerRevealedAt ||
                null,


            answerText:
                result.answer ||
                ""

        };


        renderCurrentAssistanceEverywhere();


        setAssistanceStatus(

            mountId,

            "Answer revealed.",

            false

        );


    } catch (error) {

        console.error(
            "REVEAL ANSWER ERROR:",
            error
        );


        renderCurrentAssistanceEverywhere();


        setAssistanceStatus(

            mountId,

            "Connection error. Please try again.",

            true

        );
    }
}


/* =========================================================
   LOAD CURRENT HUNT STATE
========================================================= */

async function loadHunt() {

    try {

        const response =
            await fetch(
                "/api/hunt-state",
                {
                    cache:
                        "no-store"
                }
            );


        /* ---------------------------------------------
           SESSION LOST
        --------------------------------------------- */

        if (
            response.status ===
            401
        ) {

            window.location.replace(
                "./login.html"
            );

            return;
        }


        const result =
            await response.json();


        /* ---------------------------------------------
           EVENT WAITING / RESET
        --------------------------------------------- */

        if (
            response.status ===
            409
        ) {

            window.location.replace(
                "./waiting.html"
            );

            return;
        }


        if (!response.ok) {

            console.error(
                "LOAD HUNT ERROR:",
                result.message
            );


            return;
        }


        /* ---------------------------------------------
           TEAM ALREADY FINISHED
        --------------------------------------------- */

        if (
            result.finished
        ) {

            window.location.replace(
                "./finished.html"
            );

            return;
        }


        /* ---------------------------------------------
           SERVER CLOCK
        --------------------------------------------- */

        syncServerClock(
            result.serverNow
        );


        /* ---------------------------------------------
           CURRENT STATE
        --------------------------------------------- */

        currentStage =
            result.team
                .currentStage;


        currentAssistance =
            result.assistance ||
            null;


        /* ---------------------------------------------
           HEADER
        --------------------------------------------- */

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


        /* ---------------------------------------------
           CLUE
        --------------------------------------------- */

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


        /* ---------------------------------------------
           OPTIONAL IMAGE
        --------------------------------------------- */

        setClueImage(

            "clueImageWrapper",

            "clueImage",

            result.clueImage

        );


        /* ---------------------------------------------
           HINT / ANSWER
        --------------------------------------------- */

        renderAssistance(

            "clueAssistanceMount",

            currentAssistance

        );


        /* ---------------------------------------------
           SCAN BUTTON
        --------------------------------------------- */

        document
            .getElementById(
                "scanButton"
            )
            .innerText =
                `📷 ${
                    result.scanButton
                }`;


    } catch (error) {

        console.error(
            "LOAD HUNT ERROR:",
            error
        );
    }
}


/* =========================================================
   OPEN CAMERA
========================================================= */

async function openScanner() {

    /*
     * Prevent multiple scanner
     * instances.
     */

    await stopScanner();


    document
        .getElementById(
            "clueScreen"
        )
        .classList
        .add(
            "hidden"
        );


    document
        .getElementById(
            "resultScreen"
        )
        .classList
        .add(
            "hidden"
        );


    document
        .getElementById(
            "scannerScreen"
        )
        .classList
        .remove(
            "hidden"
        );


    processingQR =
        false;


    document
        .getElementById(
            "scannerStatus"
        )
        .innerText =
            "Point your camera at the QR code.";


    if (
        typeof Html5Qrcode !==
        "function"
    ) {

        document
            .getElementById(
                "scannerStatus"
            )
            .innerText =
                "QR scanner could not be loaded. Refresh the page and try again.";


        return;
    }


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
            "CAMERA ERROR:",
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


/* =========================================================
   QR DETECTED
========================================================= */

async function onQRDetected(
    decodedText
) {

    if (
        processingQR
    ) {

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


        /* ---------------------------------------------
           SESSION LOST
        --------------------------------------------- */

        if (
            response.status ===
            401
        ) {

            window.location.replace(
                "./login.html"
            );

            return;
        }


        /* ---------------------------------------------
           EVENT RESET / STOPPED
        --------------------------------------------- */

        if (
            response.status ===
            409
        ) {

            window.location.replace(
                "./waiting.html"
            );

            return;
        }


        /* ---------------------------------------------
           WRONG QR
        --------------------------------------------- */

        if (!response.ok) {

            showWrongQR(
                result
            );


            return;
        }


        /* ---------------------------------------------
           FINAL TREASURE
        --------------------------------------------- */

        if (
            result.finished
        ) {

            window.location.replace(
                "./finished.html"
            );

            return;
        }


        /* ---------------------------------------------
           CORRECT NORMAL QR
        --------------------------------------------- */

        showCheckpointSuccess(
            result
        );


    } catch (error) {

        console.error(
            "SCAN ERROR:",
            error
        );


        showWrongQR({

            message:
                "Connection error. Please try again."

        });


    } finally {

        /*
         * Important:
         *
         * The session checker should
         * continue after result screen.
         */

        processingQR =
            false;
    }
}


/* =========================================================
   CORRECT QR
========================================================= */

function showCheckpointSuccess(
    result
) {

    /*
     * The scan response includes
     * the authoritative server time.
     */

    syncServerClock(
        result.serverNow
    );


    currentStage =
        result.nextStage;


    currentAssistance =
        result.assistance ||
        null;


    /* ---------------------------------------------
       SCREENS
    --------------------------------------------- */

    document
        .getElementById(
            "scannerScreen"
        )
        .classList
        .add(
            "hidden"
        );


    document
        .getElementById(
            "clueScreen"
        )
        .classList
        .add(
            "hidden"
        );


    document
        .getElementById(
            "resultScreen"
        )
        .classList
        .remove(
            "hidden"
        );


    document
        .getElementById(
            "resultClueArea"
        )
        .classList
        .remove(
            "hidden"
        );


    /* ---------------------------------------------
       RESULT
    --------------------------------------------- */

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
            `${
                result.completedLabel
            } Complete`;


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


    /* ---------------------------------------------
       NEXT / FINAL CLUE LABEL
    --------------------------------------------- */

    document
        .getElementById(
            "newClueLabel"
        )
        .innerText =

            result.finalStage

                ?

                "YOUR FINAL CLUE"

                :

                "YOUR NEXT CLUE";


    /* ---------------------------------------------
       NEW CLUE
    --------------------------------------------- */

    document
        .getElementById(
            "nextClue"
        )
        .innerText =
            result.revealedClue;


    /* ---------------------------------------------
       OPTIONAL IMAGE
    --------------------------------------------- */

    setClueImage(

        "nextClueImageWrapper",

        "nextClueImage",

        result.revealedClueImage

    );


    /* ---------------------------------------------
       HINT / ANSWER
    --------------------------------------------- */

    renderAssistance(

        "resultAssistanceMount",

        currentAssistance

    );


    /* ---------------------------------------------
       CONTINUE BUTTON
    --------------------------------------------- */

    const button =
        document.getElementById(
            "scanNextButton"
        );


    button.innerText =

        result.finalStage

            ?

            "Continue to Final Checkpoint"

            :

            "Continue";
}


/* =========================================================
   WRONG QR
========================================================= */

function showWrongQR(
    result
) {

    document
        .getElementById(
            "scannerScreen"
        )
        .classList
        .add(
            "hidden"
        );


    document
        .getElementById(
            "clueScreen"
        )
        .classList
        .add(
            "hidden"
        );


    document
        .getElementById(
            "resultScreen"
        )
        .classList
        .remove(
            "hidden"
        );


    /*
     * Wrong QR must NOT show the
     * next-clue area.
     */

    document
        .getElementById(
            "resultClueArea"
        )
        .classList
        .add(
            "hidden"
        );


    document
        .getElementById(
            "resultAssistanceMount"
        )
        .innerHTML =
            "";


    setClueImage(

        "nextClueImageWrapper",

        "nextClueImage",

        null

    );


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


    if (
        result.code ===
        "WRONG_TEAM"
    ) {

        title =
            "Another Team's QR";
    }


    if (
        result.code ===
        "WRONG_FINAL_QR"
    ) {

        title =
            "Wrong Final QR";
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

            result.message

            ||

            "This QR is not valid for your current route.";


    document
        .getElementById(
            "scanNextButton"
        )
        .innerText =
            "Return to Current Clue";
}


/* =========================================================
   CONTINUE
========================================================= */

async function continueHunt() {

    /*
     * Reload from server.
     *
     * This preserves:
     * - original clue time
     * - Hint reveal
     * - Answer countdown
     */

    await loadHunt();


    document
        .getElementById(
            "resultScreen"
        )
        .classList
        .add(
            "hidden"
        );


    document
        .getElementById(
            "scannerScreen"
        )
        .classList
        .add(
            "hidden"
        );


    document
        .getElementById(
            "clueScreen"
        )
        .classList
        .remove(
            "hidden"
        );
}


/* =========================================================
   CLOSE SCANNER
========================================================= */

async function closeScanner() {

    await stopScanner();


    processingQR =
        false;


    document
        .getElementById(
            "scannerScreen"
        )
        .classList
        .add(
            "hidden"
        );


    document
        .getElementById(
            "resultScreen"
        )
        .classList
        .add(
            "hidden"
        );


    document
        .getElementById(
            "clueScreen"
        )
        .classList
        .remove(
            "hidden"
        );
}


/* =========================================================
   STOP CAMERA
========================================================= */

async function stopScanner() {

    if (!qrScanner) {

        return;
    }


    try {

        /*
         * stop() may throw when
         * scanner is already stopped.
         */

        await qrScanner.stop();


    } catch (error) {

        // Already stopped.
    }


    try {

        await qrScanner.clear();


    } catch (error) {

        // Already cleared.
    }


    qrScanner =
        null;
}


/* =========================================================
   EVENT RESET / SESSION CHECK
========================================================= */

async function checkSessionState() {

    if (
        processingQR
    ) {

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


        /* ---------------------------------------------
           SESSION RESET
        --------------------------------------------- */

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


        /* ---------------------------------------------
           FINISHED TEAM
        --------------------------------------------- */

        const finishedAt =

            result.team
                ?.finishedAt

            ||

            result.team
                ?.finished_at

            ||

            null;


        if (
            finishedAt
        ) {

            await stopScanner();


            window.location.replace(
                "./finished.html"
            );


            return;
        }


        /* ---------------------------------------------
           EVENT RESET / NOT RUNNING
        --------------------------------------------- */

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

        /*
         * Temporary network problem.
         * The next polling cycle
         * will retry automatically.
         */
    }
}


/* =========================================================
   HTML SAFETY
========================================================= */

function escapeHTML(
    value
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        String(
            value ??
            ""
        );


    return div.innerHTML;
}


/* =========================================================
   START PAGE
========================================================= */

loadHunt();


/*
 * Hint / Answer countdown.
 *
 * 500 ms keeps the displayed
 * second change responsive.
 */

if (
    !assistanceTimer
) {

    assistanceTimer =
        setInterval(

            updateAssistanceCountdowns,

            500

        );
}


/*
 * Check for:
 *
 * - Admin reset
 * - logout/session reset
 * - event state changes
 */

setInterval(

    checkSessionState,

    2500

);


/* =========================================================
   PHONE BACKGROUND / SCREEN LOCK
========================================================= */

document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.visibilityState ===
            "visible"
        ) {

            checkSessionState();


            /*
             * Refresh the authoritative
             * server state after returning
             * from background.
             */

            loadHunt();
        }
    }
);


/*
 * Also covers browser history /
 * phone browser page restoration.
 */

window.addEventListener(
    "pageshow",
    () => {

        checkSessionState();

        loadHunt();
    }
);