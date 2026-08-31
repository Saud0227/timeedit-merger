# TimeEdit Merger

TimeEdit Merger is a tool for merging multiple TimeEdit sources into a single source. It allows you to customize which activities are included from each course and edit it on the fly. It also fixes the ics data and populates each fields correctly.

## Pre-requisites

Before installation, make sure you have the following installed:
- The tailscale app (can be downloaded [here](https://github.com/hassio-addons/app-tailscale), if another tailscale installation is used on HA it will not be converd in this guide
- Caddy 2 (can be downloaded [here](https://github.com/einschmidt/app-caddy-2)) This steps can be skipped, but it exposes the entire api to the internet.

## Installation
To install timeedit-merger, first add the repository to your HA apps by entering the following URL:

`https://github.com/saud0227/timeedit-merger`

If you encounter any issues, refer to the [official documentation](https://home-assistant.io/hassio/installing_third_party_addons/) for guidance.

Once the repository is added, search for and install the "TimeEdit Merger" app.

## Setup
The setup process is in 3 parts: setting up the app, seting up caddy, and setting up tailscale. The following steps will guide you through the process.

### Setting up the app

To set up TimeEdit Merger, follow these steps:
1. Generate 4 random url safe tokens using the following command in your terminal:
   ```
   python3 -c "import secrets; print(secrets.token_urlsafe(43))"
   ```
2. Asign them to the following variables in the configuration of the app:
   - `admin_token`
   - `user_token`
   - `output1 -> salt`
   - `output2 -> salt`
3. Start the app and check the logs for any errors. If there are no errors, you can access the app at `http://<your-ha-ip>:<port>/` (replace `<your-ha-ip>` with your Home Assistant IP address and `<port>` with the port you configured in the app settings).
More settings can be customized to your liking.

### Setting up Caddy
To set up Caddy, follow these steps:
1. Create a new Caddyfile at `/addon_configs/c80c7555_caddy-2/Caddyfile` (OBS: Caddyfile is case sensitive and has no file extension).
```Caddyfile
:8083 {
    @ics path_regexp ics ^/feed/[a-zA-Z0-9_-]{43}\.ics$

    handle @ics {
        reverse_proxy 127.0.0.1:8081
    }

    handle {
        respond "Not found" 404
    }
}
```
2. Set the app configuration to the following:
```yaml
non_caddyfile_config:
  email: your@email.com
  domain: mydomain.com
  destination: localhost
  port: 8123
args:
  - --watch
env_vars: []
log_level: info

```
Note that since we have created a custom Caddyfile, the `non_caddyfile_config` section is not used by Caddy.

3. Start the Caddy app and check the logs for any errors. If there are no errors, you can access the feeds at `http://<your-ha-ip>:8083/` (replace `<your-ha-ip>` with your Home Assistant IP address).

### Setting up Tailscale
To set up Tailscale, follow these steps:
1. Start the Tailscale app and log in with your Tailscale account.
2. Acces the terminal of your tailscale app  
   Easiest way is to use the termninal app in HA and run the following command:
   - `docker ps` to get the container id of the tailscale app
   - `docker exec -it <container_id> /bin/sh` to access the terminal
3. When in the terminal, run the following command  
`opt/tailscale funnel --bg 8083`
The terminal will output instructions to set up the funnel. If you skipped the caddy setup, use port 8081 instead of 8083.
4. If the funnel is set up correctly, you should be able to access the feeds at `https://<your-tailscale-ip>feed/<salt>.ics/`.

### Optional
If every step was done correctly, you should be able to access the ics feeds. Its recomended to add the tailscale url to the 
   

   