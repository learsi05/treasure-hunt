const form =
    document.getElementById(
        "loginForm"
    );


const message =
    document.getElementById(
        "message"
    );


const loginButton =
    document.getElementById(
        "loginButton"
    );


form.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        const teamName =
            document
                .getElementById(
                    "teamName"
                )
                .value
                .trim();


        const loginCode =
            document
                .getElementById(
                    "loginCode"
                )
                .value
                .trim();


        if (
            !teamName ||
            !loginCode
        ) {

            showError(
                "Enter the team name and login code."
            );

            return;
        }


        loginButton.disabled =
            true;

        loginButton.innerText =
            "Checking the seal...";


        message.innerText = "";

        message.className =
            "message";


        try {

            const response =
                await fetch(
                    "/api/team-login",
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                teamName,
                                loginCode
                            })
                    }
                );


            const result =
                await response.json();


            if (!response.ok) {

                showError(
                    result.message ||
                    "Login failed."
                );

                return;
            }


            message.className =
                "message success";

            message.innerText =
                `Welcome ${result.team.name}. Access granted.`;


            setTimeout(
                () => {

                    window.location.href =
                        "./camera.html";

                },
                700
            );


        } catch (error) {

            console.error(error);

            showError(
                "Could not connect to the server."
            );


        } finally {

            loginButton.disabled =
                false;

            loginButton.innerText =
                "Enter the Hunt";
        }
    }
);


function showError(text) {

    message.className =
        "message error";

    message.innerText =
        text;
}