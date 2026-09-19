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

function getCookie(
    req,
    name
) {

    const header =
        req.headers.cookie || "";


    for (
        const cookie
        of header.split(";")
    ) {

        const [
            key,
            ...values
        ] =
            cookie
                .trim()
                .split("=");


        if (
            key === name
        ) {

            return values.join("=");
        }
    }


    return null;
}


/* =========================================================
   ADMIN AUTH
========================================================= */

function adminToken() {

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


function authorized(
    req
) {

    return (
        getCookie(
            req,
            "admin_session"
        )
        ===
        adminToken()
    );
}


/* =========================================================
   MAIN HANDLER
========================================================= */

module.exports =
async function handler(
    req,
    res
) {

    /* =====================================================
       ADMIN SESSION
    ===================================================== */

    if (
        !authorized(
            req
        )
    ) {

        return res
            .status(401)
            .json({

                success:
                    false,

                message:
                    "Administrator session expired."

            });
    }


    res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate"
    );


    /* =====================================================
       GET FINAL QR
    ===================================================== */

    if (
        req.method ===
        "GET"
    ) {

        const {
            data,
            error
        } =
            await supabase
                .from(
                    "event_config"
                )
                .select(`
                    status,
                    final_qr_code
                `)
                .eq(
                    "id",
                    1
                )
                .maybeSingle();


        if (
            error
        ) {

            console.error(
                "LOAD FINAL QR ERROR:",
                error
            );


            return res
                .status(500)
                .json({

                    success:
                        false,

                    message:
                        "Could not load the final QR configuration."

                });
        }


        if (!data) {

            return res
                .status(500)
                .json({

                    success:
                        false,

                    message:
                        "Event configuration was not found."

                });
        }


        return res
            .status(200)
            .json({

                success:
                    true,

                eventStatus:
                    data.status,

                finalQrCode:
                    data.final_qr_code ||
                    null

            });
    }


    /* =====================================================
       SAVE / UPDATE FINAL QR
    ===================================================== */

    if (
        req.method ===
        "POST"
    ) {

        /* -------------------------------------------------
           EVENT MUST BE WAITING
        ------------------------------------------------- */

        const {
            data: event,
            error: eventError
        } =
            await supabase
                .from(
                    "event_config"
                )
                .select(`
                    status,
                    final_qr_code
                `)
                .eq(
                    "id",
                    1
                )
                .maybeSingle();


        if (
            eventError
        ) {

            console.error(
                "FINAL QR EVENT CHECK ERROR:",
                eventError
            );


            return res
                .status(500)
                .json({

                    success:
                        false,

                    message:
                        "Could not verify event status."

                });
        }


        if (!event) {

            return res
                .status(500)
                .json({

                    success:
                        false,

                    message:
                        "Event configuration was not found."

                });
        }


        if (
            event.status !==
            "waiting"
        ) {

            return res
                .status(409)
                .json({

                    success:
                        false,

                    message:
                        "The final QR can only be changed while the event is waiting. Reset the event first."

                });
        }


        /* -------------------------------------------------
           QR VALUE
        ------------------------------------------------- */

        const {
            finalQrCode
        } =
            req.body || {};


        const cleanCode =
            String(
                finalQrCode ||
                ""
            )
                .trim();


        if (!cleanCode) {

            return res
                .status(400)
                .json({

                    success:
                        false,

                    message:
                        "Final QR value is required."

                });
        }


        /* =================================================
           MAKE SURE FINAL QR IS NOT USED BY ANY TEAM ROUTE
        ================================================= */

        const {
            data: existingRoute,
            error: routeCheckError
        } =
            await supabase
                .from(
                    "team_routes"
                )
                .select(`
                    id,
                    team_id,
                    checkpoint_number
                `)
                .eq(
                    "qr_code",
                    cleanCode
                )
                .maybeSingle();


        if (
            routeCheckError
        ) {

            console.error(
                "FINAL QR DUPLICATE CHECK ERROR:",
                routeCheckError
            );


            return res
                .status(500)
                .json({

                    success:
                        false,

                    message:
                        "Could not verify whether this QR is already in use."

                });
        }


        if (
            existingRoute
        ) {

            return res
                .status(400)
                .json({

                    success:
                        false,

                    message:
                        "This QR is already assigned to one of the team checkpoints. Use a different QR for the common final checkpoint."

                });
        }


        /* =================================================
           SAVE FINAL QR
        ================================================= */

        const {
            error: updateError
        } =
            await supabase
                .from(
                    "event_config"
                )
                .update({

                    final_qr_code:
                        cleanCode

                })
                .eq(
                    "id",
                    1
                );


        if (
            updateError
        ) {

            console.error(
                "SAVE FINAL QR ERROR:",
                updateError
            );


            return res
                .status(500)
                .json({

                    success:
                        false,

                    message:
                        "Could not save the final QR."

                });
        }


        return res
            .status(200)
            .json({

                success:
                    true,

                finalQrCode:
                    cleanCode,

                message:
                    "Common Checkpoint 5 QR saved successfully."

            });
    }


    /* =====================================================
       METHOD NOT ALLOWED
    ===================================================== */

    return res
        .status(405)
        .json({

            success:
                false,

            message:
                "Method not allowed."

        });
};