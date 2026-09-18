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


function getCookie(req, name) {

    const header =
        req.headers.cookie || "";

    for (const cookie of header.split(";")) {

        const [
            key,
            ...values
        ] =
            cookie.trim().split("=");

        if (key === name) {
            return values.join("=");
        }
    }

    return null;
}


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


module.exports =
async function handler(req, res) {

    if (!authorized(req)) {

        return res.status(401).json({
            success: false,
            message:
                "Administrator session expired."
        });
    }


    // ================================
    // LOAD ROUTE
    // ================================

    if (req.method === "GET") {

        const teamId =
            Number(req.query.teamId);


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
        } = await supabase
            .from("team_routes")
            .select(`
                id,
                checkpoint_number,
                qr_code,
                clue
            `)
            .eq(
                "team_id",
                teamId
            )
            .order(
                "checkpoint_number"
            );


        if (error) {

            return res.status(500).json({
                success: false,
                message:
                    error.message
            });
        }


        return res.status(200).json({
            success: true,
            route: data
        });
    }


    // ================================
    // SAVE CHECKPOINT
    // ================================

    if (req.method === "POST") {

        const {
            teamId,
            checkpointNumber,
            qrCode,
            clue
        } = req.body || {};


        if (
            !teamId ||
            !checkpointNumber ||
            !qrCode ||
            !clue
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "QR code and clue are required."
            });
        }


        if (
            checkpointNumber < 1 ||
            checkpointNumber > 5
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid checkpoint."
            });
        }


        const {
            data,
            error
        } = await supabase
            .from("team_routes")
            .upsert(
                {
                    team_id:
                        Number(teamId),

                    checkpoint_number:
                        Number(
                            checkpointNumber
                        ),

                    qr_code:
                        String(qrCode)
                            .trim(),

                    clue:
                        String(clue)
                            .trim(),

                    updated_at:
                        new Date()
                            .toISOString()
                },
                {
                    onConflict:
                        "team_id,checkpoint_number"
                }
            )
            .select()
            .single();


        if (error) {

            if (
                error.code ===
                "23505"
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "This QR code is already assigned somewhere else."
                });
            }


            return res.status(500).json({
                success: false,
                message:
                    error.message
            });
        }


        // Check if this team now has all 5 routes

        const {
            count
        } = await supabase
            .from("team_routes")
            .select(
                "*",
                {
                    count: "exact",
                    head: true
                }
            )
            .eq(
                "team_id",
                Number(teamId)
            );


        await supabase
            .from("teams")
            .update({
                route_ready:
                    count === 5
            })
            .eq(
                "id",
                Number(teamId)
            );


        return res.status(200).json({
            success: true,
            checkpoint: data
        });
    }


    return res.status(405).json({
        success: false
    });
};