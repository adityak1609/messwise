# Credits and licences

MessWise's interface, illustrations, record workflow, calculations, and AWS configuration were written for this project. Original project code remains the owner's work; a project licence has not yet been selected.

## Software used

| Dependency | Use | Licence | Source |
| --- | --- | --- | --- |
| React and React DOM | Interface | MIT | https://github.com/facebook/react |
| Lucide React | Icons | ISC | https://github.com/lucide-icons/lucide |
| Vite and React plugin | Development and bundling | MIT | https://github.com/vitejs/vite |
| TypeScript | Type checking | Apache-2.0 | https://github.com/microsoft/TypeScript |
| Vitest | Unit testing | MIT | https://github.com/vitest-dev/vitest |
| Testing Library React and user-event | App workflow verification | MIT | https://github.com/testing-library |
| jsdom | Browser DOM for tests | MIT | https://github.com/jsdom/jsdom |
| fake-indexeddb | Photo persistence verification | Apache-2.0 | https://github.com/dumbmatter/fakeIndexedDB |
| esbuild | Lambda bundling | MIT | https://github.com/evanw/esbuild |
| fflate | Deployment ZIP archives | MIT | https://github.com/101arrowz/fflate |
| yaml | CloudFormation template conversion | ISC | https://github.com/eemeli/yaml |
| AWS SDK for JavaScript v3 | AWS API integration and photo signing | Apache-2.0 | https://github.com/aws/aws-sdk-js-v3 |
| DM Sans | Typography served by Google Fonts | SIL Open Font License 1.1 | https://github.com/google/fonts/tree/main/ofl/dmsans |
| Manrope | Typography served by Google Fonts | SIL Open Font License 1.1 | https://github.com/google/fonts/tree/main/ofl/manrope |

Exact dependency versions are recorded in the root and backend package lock files. Dependencies include their own licence files in installed packages. Keep their applicable notices when redistributing them.

The console Lambda package includes licence/notice files for bundled third-party packages under `licenses/`; esbuild also preserves legal comments. Transitive dependencies retain their respective upstream licences.

Each frontend build includes `third-party-notices.txt` with these credits and the complete React, React DOM, Scheduler, and Lucide licence notices.

## Data and images

The seven demonstration records are fictional examples created for this app, explicitly labelled in the interface. They contain no fabricated measurement-board photographs. The bowl illustration and favicon are original SVG artwork.

Real menu information, measurements, and photo ownership should be credited to their actual source when collected. Obtain permission to use friends' photographs and avoid identifying people in public submission materials.

Food-waste measurement principles were informed by [EPA's food-waste assessment guidance](https://www.epa.gov/sustainable-management-food/tools-preventing-and-diverting-wasted-food). The app does not reproduce its toolkit or illustrations.

## AI assistance

OpenAI Codex was used for project planning, implementation, and verification. The owner also used Claude for idea comparison and scope planning. This version does not use a runtime AI model to estimate food weight.
