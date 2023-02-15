/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable import/prefer-default-export */
declare module 'botometer' {
    export class Botometer {
      constructor(settings: any);
      async getScores(users: string[]): Promise<any>;
    };
  }