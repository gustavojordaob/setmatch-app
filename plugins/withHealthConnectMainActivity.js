const { withDangerousMod } = require('@expo/config-plugins');
const { getMainActivityAsync } = require('@expo/config-plugins/build/android/Paths');
const fs = require('fs');

const IMPORT = 'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
const MARKER = 'HealthConnectPermissionDelegate.setPermissionDelegate(this)';

/**
 * Health Connect exige registerForActivityResult ANTES de Activity.onCreate.
 * O listener Expo (ReactActivityDelegateWrapper) roda tarde demais — registrar aqui.
 */
function withHealthConnectMainActivity(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const activity = await getMainActivityAsync(projectRoot);
      let contents = await fs.promises.readFile(activity.path, 'utf8');

      if (contents.includes(MARKER)) {
        return config;
      }

      if (!contents.includes(IMPORT)) {
        contents = contents.replace(/^package .+\n/m, (m) => `${m}${IMPORT}\n`);
      }

      const injected = contents.replace(
        /(\s*)super\.onCreate\((null|savedInstanceState)\)/,
        `$1${MARKER}\n$1super.onCreate($2)`
      );

      if (injected === contents) {
        throw new Error(
          '[withHealthConnectMainActivity] Não achou super.onCreate() em MainActivity.kt'
        );
      }

      await fs.promises.writeFile(activity.path, injected);
      return config;
    },
  ]);
}

module.exports = withHealthConnectMainActivity;
