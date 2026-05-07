import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'electron/**/*']
  },
  firebaseRulesPlugin.configs['flat/recommended']
];
