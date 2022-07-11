# F1 Telemetry Data Collector

This Python application uses InfluxDB to collect telemetry data from the
official F1 game.

## Installation

The application requires Python >= 3.8 to work.

~~~
pip install pipx
pipx install git+https://github.com/p403n1x87/f1-telemetry
~~~

## Usage

Ensure that InfluxDB is running with at least an Org and an access token, and
configured with an `f1-telemetry` bucket.

~~~
f1-tel <org> <token>
~~~

The repository has a very basic web application for time-series visualisations.
With InfluxDB still running, open the `webapp/index.html` page in the browser
with the `org` and `token` parameters, e.g.

~~~
file:///C:/Users/Gabriele/Projects/f1-telemetry/webapp/index.html?org=P403n1x87&token=NLyjW4ml8XuTPTwCbtC5PC1Z-JJ6lwjAm7B1-ScM_XP9N_eoCkIGTmm3wHrC92cQVsMmKofgqbx6PM-ZZgVQKw==
~~~

## InfluxDB Boards

The repository comes with some pre-defined InfluxDB boards in the `boards`
folder, which can be imported directly into the database. Note that the default
bucket `f1-telemetry` is used.
