const { createClient } =
    require("@supabase/supabase-js");

const crypto =
    require("crypto");


const supabase =
    createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SECRET_KEY
    );


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


        if (key === name) {

            return decodeURIComponent(
                values.join("=")
            );
        }
    }


    return null;
}


function hashToken(token) {

    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}


module.exports =
async function handler(
    req,
    res
) {

    const token =
        getCookie(
            req,
            "treasure_session"
        );


    if (!token) {

        return res
            .status(401)
            .json({
                success: false
            });
    }


    const tokenHash =
        hashToken(token);


    const {
        data: team
    } =
        await supabase
            .from("teams")
            .select(`
                id,
                team_name,
                current_checkpoint,
                finished_at
            `)
            .eq(
                "active_session_token",
                tokenHash
            )
            .maybeSingle();


    if (!team) {

        return res
            .status(401)
            .json({
                success: false
            });
    }


    if (team.finished_at) {

        return res
            .status(200)
            .json({
                success: true,
                finished: true,

                team: {
                    name:
                        team.team_name
                }
            });
    }


    const {
        data: event
    } =
        await supabase
            .from(
                "event_config"
            )
            .select(`
                status,
                started_at
            `)
            .eq(
                "id",
                1
            )
            .single();


    if (
        event.status !==
        "running"
    ) {

        return res
            .status(409)
            .json({
                success: false,

                eventStatus:
                    event.status
            });
    }


    const stage =
        team.current_checkpoint;


    /*
     * STAGE 1
     *
     * Before the team has scanned
     * its Starting QR.
     */

    if (stage === 1) {

        return res
            .status(200)
            .json({

                success: true,

                finished: false,

                team: {
                    name:
                        team.team_name,

                    currentStage:
                        1
                },

                stageLabel:
                    "START",

                clueTitle:
                    "Starting Challenge",

                clue:
                    "Find the QR assigned to your team somewhere in this room.",

                scanButton:
                    "Scan Starting QR",

                finalStage:
                    false
            });
    }


    /*
     * STAGES 2-6
     *
     * Display the clue revealed
     * by the previous successful QR.
     */

    const previousStage =
        stage - 1;


    const {
        data: previousRoute
    } =
        await supabase
            .from(
                "team_routes"
            )
            .select(
                "clue"
            )
            .eq(
                "team_id",
                team.id
            )
            .eq(
                "checkpoint_number",
                previousStage
            )
            .single();


    if (!previousRoute) {

        return res
            .status(500)
            .json({
                success: false,

                message:
                    "Route is not configured correctly."
            });
    }


    /*
     * STAGE 6 = COMMON CP5
     */

    if (stage === 6) {

        return res
            .status(200)
            .json({

                success: true,

                finished: false,

                team: {
                    name:
                        team.team_name,

                    currentStage:
                        6
                },

                stageLabel:
                    "CP 5 / 5",

                clueTitle:
                    "Final Checkpoint",

                clue:
                    previousRoute.clue,

                scanButton:
                    "Scan Final QR",

                finalStage:
                    true
            });
    }


    /*
     * STAGES:
     *
     * 2 = CP1
     * 3 = CP2
     * 4 = CP3
     * 5 = CP4
     */

    const physicalCheckpoint =
        stage - 1;


    return res
        .status(200)
        .json({

            success: true,

            finished: false,

            team: {
                name:
                    team.team_name,

                currentStage:
                    stage
            },

            stageLabel:
                `CP ${physicalCheckpoint} / 5`,

            clueTitle:
                `Checkpoint ${physicalCheckpoint}`,

            clue:
                previousRoute.clue,

            scanButton:
                "Scan QR",

            finalStage:
                false
        });
};