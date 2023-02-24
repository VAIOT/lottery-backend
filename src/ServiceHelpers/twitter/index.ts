import Botometer from './botometer';
import V1 from "./v1";
import V2 from "./v2";

export namespace twitter {
    export const apiV1 = new V1;
    export const apiV2 = new V2;
    export const botometer = new Botometer();

    export function getPostId(url: string): string {
        const postId = url.split("/").find((el, index, obj) => obj[index-1] === "status")?.split('?')[0];
        if (!postId) {
            return ''
        }
        return postId;
    }
}