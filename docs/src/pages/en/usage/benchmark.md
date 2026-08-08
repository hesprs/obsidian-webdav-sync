# Benchmark

All benchmark results are recorded here, see [deep dive: benchmarking](../deep-dive/benchmarking) for benchmarking details. Sync Engine welcomes everyone contributing benchmarking results as long as it follows the steps specified in the spec.

## Apparent Statistics

Startup speed measures the time by which the plugin delays the cold start of Obsidian APP.

|              | Sync Engine[^1] | Remotely Save | Nextcloud Sync |
| ------------ | --------------- | ------------- | -------------- |
| Version      | 3.0.0           | 0.5.25        | 0.7.38         |
| Startup Time | 25.4 ms         | 251 ms        | **18.6 ms**    |
| Plugin Size  | **145 KB**      | 4050 KB       | 515 KB         |

[^1]: The startup speed of Sync Engine is measured with a module loaded.

## WebDAV Performance

- **Obsidian version**: 1.13.4
- **Operating system**: NixOS 26.11
- **CPU single core score**: around 1700
- **Backend**: Self-hosted Nextcloud WebDAV[^2]
- **Average ping**: 400 ms
- **Average upload speed**: 2.6 MiB/s
- **Average download speed**: 4.8 MiB/s

[^2]: During local testing, Nextcloud connection is delayed and bandwidth is limited to simulate middle-to-low network quality.

| Item                                      | Sync Engine                                               | Remotely Save                             | Nextcloud Sync                                                        |
| ----------------------------------------- | --------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------- |
| Version                                   | 3.0.0 + `webdav` module 0.1.7                             | 0.5.25                                    | 0.7.38                                                                |
| 2000 files upload                         | **9.43 min**                                              | 16.4 min                                  | 17.95 min                                                             |
| 2000 files download                       | 5.87 min                                                  | 13.68 min                                 | **5.22 min**                                                          |
| Daily simulation<br>(Original, 10 rounds) | Min: **1.04 s**<br>Median: **1.44 s**<br>Max: **48.56 s** | Min: 99 s<br>Median: 129 s<br>Max: 326 s  | Min: 1.27 s<br>Median: 2.75 s<br>Max: 60.55 s                         |
| Daily simulation<br>(Replica, 10 rounds)  | Min: 1.06 s<br>Median: **1.72 s**<br>Max: **3.49 s**      | Min: 111 s<br>Median: 117 s<br>Max: 204 s | Min: **0.4 s**<br>Median: 3.94 s<br>Max: 55.33 s                      |
| Correctness validation                    | 0 errors                                                  | 0 errors                                  | <span style="color: var(--rose); font-weight: bold;">98 errors</span> |

In terms of syncing performance, Sync Engine is visibly faster than Remotely Save in terms of full upload and download. In the more realistic daily sync test, Remotely Save fails catastrophically and Sync Engine is around **100x faster** than Remotely Save.

Although claimed to be optimized for Nextcloud, Nextcloud Sync still shows visible disadvantage in terms of performance compared with Sync Engine. More importantly, it **fails to sync 98 original files or changes to the replica**, and many errors appeared during the testing process.
