# F1 Telemetry Data Collector

This Python application uses InfluxDB to collect telemetry data from the
official F1 game.

<p align="center">
    <img src="art/telemetry-demo.gif"/>
</p>

It is also possible to display live session and car data.

<p align="center">
    <img src="art/live-data.png"/>
</p>


## Installation

The application requires Python >= 3.8 to work.

~~~
pip install pipx
pipx install f1-telemetry
~~~

## Usage

Ensure that InfluxDB is running with at least an Org and an access token, and
configured with an `f1-telemetry` bucket.

~~~
f1-tel <org> <token>
~~~

This also serves a very basic web application for time-series and live data
visualisations. With InfluxDB still running, navigate to
`http://localhost:20776/index.html` page in the browser with the `org` and
`token` parameters, e.g.

~~~
http://localhost:20776/index.html?org=P403n1x87&token=NLyjW4ml8XuTPTwCbtC5PC1Z-JJ6lwjAm7B1-ScM_XP9N_eoCkIGTmm3wHrC92cQVsMmKofgqbx6PM-ZZgVQKw==
~~~
