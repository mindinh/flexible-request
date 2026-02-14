// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import cds from '@sap/cds/eslint.config.mjs'
export default [...cds.recommended, ...storybook.configs["flat/recommended"]];
