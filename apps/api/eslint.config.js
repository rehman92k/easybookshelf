import nestjsConfig from '@easybookshelf/eslint-config/nestjs';

export default [...nestjsConfig, { ignores: ['dist/**'] }];
