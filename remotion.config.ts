import { Config } from '@remotion/cli/config';

Config.setBrowserExecutable(null);
Config.setChromiumDisableWebSecurity(true);
Config.setChromiumIgnoreCertificateErrors(true);