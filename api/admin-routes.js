const { createClient } =
    require("@supabase/supabase-js");

const crypto =
    require("crypto");


const supabase =
    createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SECRET_KEY,
        {
            auth: {
                persistSession: false
            }
        }
    );


/* =========================================================
   COOKIE
========================================================= */

function getCookie(req, name) {

    const header =
        req.headers.cookie || "";


    for (const cookie of header.split(";")) {

        const [
            key,
            ...values
        ] =
            cookie
                .trim()
                .split("=");


        if (key === name) {

            return values.join("=");
        }
    }


    return null;
}


/* =========================================================
   ADMIN AUTH
========================================================= */

function expectedAdminToken() {

    return crypto
        .createHmac(
            "sha256",
            process.env.ADMIN_PASSWORD
        )
        .update(
            "treasure-hunt-admin"
        )
        .digest("hex");
}


function authorized(req) {

    return (
        getCookie(
            req,
            "admin_session"
        )
        ===
        expectedAdminToken()
    );
}


/* =========================================================
   IMAGE HELPERS
========================================================= */

function extensionFromMime(mime) {

    switch (mime) {

        case "image/png":
            return "png";

        case "image/webp":
            return "webp";

        case "image/jpeg":
        case "image/jpg":
        default:
            return "jpg";
    }
}


function possibleImagePaths(
    teamId,
    checkpointNumber
) {

    const base =
        `team-${teamId}/stage-${checkpointNumber}`;


    return [

        base,

        `${base}.jpg`,

        `${base}.jpeg`,

        `${base}.png`,

        `${base}.webp`

    ];
}


/* =========================================================
   HANDLER
========================================================= */

module.exports =
async function handler(req, res) {

    /* -----------------------------------------------------
       ADMIN SESSION
    ----------------------------------------------------- */

    if (!authorized(req)) {

        return res.status(401).json({

            success: false,

            message:
                "Administrator session expired."

        });
    }


    /* =====================================================
       GET ROUTE
    ===================================================== */

    if (req.method === "GET") {

        const teamId =
            Number(
                req.query.teamId
            );


        if (!teamId) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid team."

            });
        }


        const {
            data,
            error
        } =
            await supabase
                .from("team_routes")
                .select(`
                    id,
                    checkpoint_number,
                    qr_code,
                    clue,
                    clue_image_url,
                    hint,
                    answer,
                    updated_at
                `)
                .eq(
                    "team_id",
                    teamId
                )
                .order(
                    "checkpoint_number"
                );


        if (error) {

            console.error(
                "LOAD ROUTE ERROR:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    error.message

            });
        }


        return res.status(200).json({

            success: true,

            route:
                data || []

        });
    }


    /* =====================================================
       SAVE ROUTE STAGE
    ===================================================== */

    if (req.method === "POST") {

        /* -------------------------------------------------
           EVENT MUST BE WAITING
        ------------------------------------------------- */

        const {
            data: event,
            error: eventError
        } =
            await supabase
                .from("event_config")
                .select("status")
                .eq(
                    "id",
                    1
                )
                .single();


        if (eventError) {

            console.error(
                "EVENT STATUS ERROR:",
                eventError
            );


            return res.status(500).json({

                success: false,

                message:
                    "Could not check event status."

            });
        }


        if (
            event.status !==
            "waiting"
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Routes cannot be edited after the event has started. Reset the event first."

            });
        }


        /* -------------------------------------------------
           REQUEST DATA
        ------------------------------------------------- */

        const {

            teamId,

            checkpointNumber,

            qrCode,

            clue,

            hint,

            answer,

            clueImageData,

            clueImageMime,

            removeClueImage

        } =
            req.body || {};


        const cleanTeamId =
            Number(teamId);


        const cleanCheckpoint =
            Number(
                checkpointNumber
            );


        const cleanQr =
            String(
                qrCode || ""
            ).trim();


        const cleanClue =
            String(
                clue || ""
            ).trim();


        const cleanHint =
            String(
                hint || ""
            ).trim();


        const cleanAnswer =
            String(
                answer || ""
            ).trim();


        /* -------------------------------------------------
           VALIDATION
        ------------------------------------------------- */

        if (
            !cleanTeamId ||
            !cleanCheckpoint ||
            !cleanQr ||
            !cleanClue
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "QR code and clue are required."

            });
        }


        if (
            cleanCheckpoint < 1 ||
            cleanCheckpoint > 5
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid route stage."

            });
        }


        /* -------------------------------------------------
           VERIFY TEAM EXISTS
        ------------------------------------------------- */

        const {
            data: team,
            error: teamError
        } =
            await supabase
                .from("teams")
                .select(`
                    id,
                    team_name
                `)
                .eq(
                    "id",
                    cleanTeamId
                )
                .maybeSingle();


        if (
            teamError ||
            !team
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Team not found."

            });
        }


        /* -------------------------------------------------
           LOAD EXISTING ROUTE IMAGE
        ------------------------------------------------- */

        const {
            data: existingRoute,
            error: existingRouteError
        } =
            await supabase
                .from("team_routes")
                .select(`
                    id,
                    clue_image_url
                `)
                .eq(
                    "team_id",
                    cleanTeamId
                )
                .eq(
                    "checkpoint_number",
                    cleanCheckpoint
                )
                .maybeSingle();


        if (existingRouteError) {

            console.error(
                "EXISTING ROUTE ERROR:",
                existingRouteError
            );


            return res.status(500).json({

                success: false,

                message:
                    "Could not load existing route."

            });
        }


        let clueImageUrl =
            existingRoute
                ?
                existingRoute.clue_image_url
                :
                null;


        /* =================================================
           REMOVE OLD IMAGE
        ================================================= */

        if (removeClueImage) {

            const paths =
                possibleImagePaths(
                    cleanTeamId,
                    cleanCheckpoint
                );


            const {
                error: removeError
            } =
                await supabase
                    .storage
                    .from(
                        "clue-images"
                    )
                    .remove(
                        paths
                    );


            if (removeError) {

                console.error(
                    "REMOVE CLUE IMAGE ERROR:",
                    removeError
                );
            }


            clueImageUrl =
                null;
        }


        /* =================================================
           UPLOAD NEW CLUE IMAGE
        ================================================= */

        if (
            clueImageData &&
            clueImageMime
        ) {

            try {

                const allowedTypes = [

                    "image/jpeg",

                    "image/jpg",

                    "image/png",

                    "image/webp"

                ];


                if (
                    !allowedTypes.includes(
                        clueImageMime
                    )
                ) {

                    return res.status(400).json({

                        success: false,

                        message:
                            "Clue image must be JPG, PNG or WebP."

                    });
                }


                const base64 =
                    clueImageData.includes(",")
                        ?
                        clueImageData
                            .split(",")[1]
                        :
                        clueImageData;


                const imageBuffer =
                    Buffer.from(
                        base64,
                        "base64"
                    );


                /*
                 * Keep uploads reasonably small.
                 * Frontend will also resize/compress.
                 */

                if (
                    imageBuffer.length >
                    3 * 1024 * 1024
                ) {

                    return res.status(400).json({

                        success: false,

                        message:
                            "Clue image is too large. Please use an image below 3 MB."

                    });
                }


                /*
                 * Remove any previous image
                 * extension before uploading.
                 */

                await supabase
                    .storage
                    .from(
                        "clue-images"
                    )
                    .remove(
                        possibleImagePaths(
                            cleanTeamId,
                            cleanCheckpoint
                        )
                    );


                const extension =
                    extensionFromMime(
                        clueImageMime
                    );


                const imagePath =
                    `team-${cleanTeamId}/stage-${cleanCheckpoint}.${extension}`;


                const {
                    error: uploadError
                } =
                    await supabase
                        .storage
                        .from(
                            "clue-images"
                        )
                        .upload(
                            imagePath,
                            imageBuffer,
                            {
                                contentType:
                                    clueImageMime,

                                upsert:
                                    true,

                                cacheControl:
                                    "0"
                            }
                        );


                if (uploadError) {

                    console.error(
                        "CLUE IMAGE UPLOAD ERROR:",
                        uploadError
                    );


                    return res.status(500).json({

                        success: false,

                        message:
                            "Could not upload clue image."

                    });
                }


                const {
                    data: publicData
                } =
                    supabase
                        .storage
                        .from(
                            "clue-images"
                        )
                        .getPublicUrl(
                            imagePath
                        );


                clueImageUrl =
                    `${publicData.publicUrl}?v=${Date.now()}`;


            } catch (error) {

                console.error(
                    "CLUE IMAGE PROCESS ERROR:",
                    error
                );


                return res.status(500).json({

                    success: false,

                    message:
                        "Could not process clue image."

                });
            }
        }


        /* =================================================
           SAVE ROUTE
        ================================================= */

        const {
            data,
            error
        } =
            await supabase
                .from("team_routes")
                .upsert(
                    {

                        team_id:
                            cleanTeamId,

                        checkpoint_number:
                            cleanCheckpoint,

                        qr_code:
                            cleanQr,

                        clue:
                            cleanClue,

                        clue_image_url:
                            clueImageUrl,

                        hint:
                            cleanHint || null,

                        answer:
                            cleanAnswer || null,

                        updated_at:
                            new Date()
                                .toISOString()

                    },
                    {
                        onConflict:
                            "team_id,checkpoint_number"
                    }
                )
                .select(`
                    id,
                    team_id,
                    checkpoint_number,
                    qr_code,
                    clue,
                    clue_image_url,
                    hint,
                    answer,
                    updated_at
                `)
                .single();


        if (error) {

            console.error(
                "SAVE ROUTE ERROR:",
                error
            );


            if (
                error.code ===
                "23505"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "This QR code is already assigned to another route."

                });
            }


            return res.status(500).json({

                success: false,

                message:
                    error.message

            });
        }


        /* =================================================
           ROUTE READY STATUS
        ================================================= */

        const {
            data: configuredRoutes,
            error: routeCountError
        } =
            await supabase
                .from("team_routes")
                .select(`
                    checkpoint_number,
                    qr_code,
                    clue
                `)
                .eq(
                    "team_id",
                    cleanTeamId
                );


        if (routeCountError) {

            console.error(
                "ROUTE READY ERROR:",
                routeCountError
            );
        }


        let routeReady =
            false;


        if (configuredRoutes) {

            const uniqueStages =
                new Set(
                    configuredRoutes
                        .filter(
                            route =>
                                route.qr_code &&
                                route.clue
                        )
                        .map(
                            route =>
                                route.checkpoint_number
                        )
                );


            routeReady =
                uniqueStages.size === 5;
        }


        await supabase
            .from("teams")
            .update({
                route_ready:
                    routeReady
            })
            .eq(
                "id",
                cleanTeamId
            );


        /* =================================================
           SUCCESS
        ================================================= */

        return res.status(200).json({

            success: true,

            message:
                "Route stage saved successfully.",

            routeReady,

            checkpoint:
                data

        });
    }


    /* =====================================================
       METHOD NOT ALLOWED
    ===================================================== */

    return res.status(405).json({

        success: false,

        message:
            "Method not allowed."

    });
};