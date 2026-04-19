import APIClient from "./APIClient"

function joinApiResourceUrl(base: string, resourcePath: string): string {
    const b = (base || "").trim().replace(/\/+$/, "")
    const p = (resourcePath || "").trim().replace(/^\/+/, "")
    if (!p) {
        return b ? `${b}/` : ""
    }
    if (!b) {
        return `/${p}`
    }
    return `${b}/${p}`
}

export class Emoji {
    key!: string
    name!: string
    image!: string
    constructor(key: string, name: string, image: string) {
        this.key = key
        this.name = name
        this.image = image
    }
}

export interface EmojiService {
    getImage(name: string): string
    getAllEmoji(): Array<Emoji>
}

export class DefaultEmojiService implements EmojiService {
    private constructor() {
    }
    public static shared = new DefaultEmojiService()
    emojiMap = new Map<string, string>([
        ["😀", "0_0"],
        ["😃", "0_1"],
        ["😄", "0_2"],
        ["😁", "0_3"],
        ["😆", "0_4"],
        ["😅", "0_5"],
        ["😂", "0_6"],
        ["🤣", "0_7"],
        ["🥲", "0_8"],
        ["\u263A\uFE0F", "0_9"],
        ["😊", "0_10"],
        ["😇", "0_11"],
        ["🙂", "0_12"],
        ["🙃", "0_13"],
        ["😉", "0_14"],
        ["😌", "0_15"],
        ["😍", "0_16"],
        ["🥰", "0_17"],
        ["😘", "0_18"],
        ["😗", "0_19"],
        ["😙", "0_20"],
        ["😚", "0_21"],
        ["😋", "0_22"],
        ["😛", "0_23"],
        ["😝", "0_24"],
        ["😜", "0_25"],
        ["🤪", "0_26"],
        ["🤨", "0_27"],
        ["🧐", "0_28"],
        ["🤓", "0_29"],
        ["😎", "0_30"],
        ["🥸", "0_31"],
        ["🤩", "0_32"],
        ["🥳", "0_33"],
        ["😏", "0_34"],
        ["😒", "0_35"],
        ["😞", "0_36"],
        ["😔", "0_37"],
        ["😟", "0_38"],
        ["😕", "0_39"],
        ["🙁", "0_40"],
        ["☹️", "0_41"],
        ["😣", "0_42"],
        ["😖", "0_43"],
        ["😫", "0_44"],
        ["😩", "0_45"],
        ["🥺", "0_46"],
        ["😢", "0_47"],
        ["😭", "0_48"],
        ["😤", "0_49"],
        ["😠", "0_50"],
        ["😡", "0_51"],
        ["🤬", "0_52"],
        ["🤯", "0_53"],
        ["😳", "0_54"],
        ["🥵", "0_55"],
        ["🥶", "0_56"],
        ["😱", "0_57"],
        ["😨", "0_58"],
        ["😰", "0_59"],
        ["😥", "0_60"],
        ["😓", "0_61"],
        ["🤗", "0_62"],
        ["🤔", "0_63"],
        ["🤭", "0_64"],
        ["🤫", "0_65"],
        ["🤥", "0_66"],
        ["😶", "0_67"],
        ["😐", "0_68"],
        ["😑", "0_69"],
        ["😬", "0_70"],
        ["🙄", "0_71"],
        ["😯", "0_72"],
        ["😦", "0_73"],
        ["😧", "0_74"],
        ["😮", "0_75"],
        ["😲", "0_76"],
        ["🥱", "0_77"],
        ["😴", "0_78"],
        ["🤤", "0_79"],
        ["😪", "0_80"],
        ["😵", "0_81"],
        ["🤐", "0_82"],
        ["🥴", "0_83"],
        ["🤢", "0_84"],
        ["🤮", "0_85"],
        ["🤧", "0_86"],
        ["😷", "0_87"],
        ["🤒", "0_88"],
        ["🤕", "0_89"],
        ["🤑", "0_90"],
        ["🤠", "0_91"],
        ["😈", "0_92"],
        ["👿", "0_93"],
        ["👹", "0_94"],
        ["👺", "0_95"],
        ["🤡", "0_96"],
        ["💩", "0_97"],
        ["👻", "0_98"],
        ["💀", "0_99"],
        ["☠️", "0_100"],
        ["👽", "0_101"],
        ["👾", "0_102"],
        ["🤖", "0_103"],
        ["🎃", "0_104"],
        ["😺", "0_105"],
        ["😸", "0_106"],
        ["😹", "0_107"],
        ["😻", "0_108"],
        ["😼", "0_109"],
        ["😽", "0_110"],
        ["🙀", "0_111"],
        ["😿", "0_112"],
        ["😾", "0_113"],
        ["👋", "0_114"],
        ["🤚", "0_115"],
        ["🖐", "0_116"],
        ["✋", "0_117"],
        ["🖖", "0_118"],
        ["👌", "0_119"],
        ["🤌", "0_120"],
        ["🤏", "0_121"],
        ["✌️", "0_122"],
        ["🤞", "0_123"],
        ["🤟", "0_124"],
        ["🤘", "0_125"],
        ["🤙", "0_126"],
        ["👈", "0_127"],
        ["👉", "0_128"],
        ["👆", "0_129"],
        ["🖕", "0_130"],
        ["👇", "0_131"],
        ["☝️", "0_132"],
        ["👍", "0_133"],
        ["👎", "0_134"],
        ["✊", "0_135"],
        ["👊", "0_136"],
        ["🤛", "0_137"],
        ["🤜", "0_138"],
        ["👏", "0_139"],
        ["🙌", "0_140"],
        ["👐", "0_141"],
        ["🤲", "0_142"],
        ["🤝", "0_143"],
        ["🙏", "0_144"],
        ["✍️", "0_145"],
        ["💪", "0_146"],
        ["🦾", "0_147"],
        ["🦶", "0_148"],
        ["👂", "0_149"],
        ["👃", "0_150"],
        ["💋", "0_151"],

    ])

    emojiKeys? :string[] 

    emojiRegExp() {
        if(!this.emojiKeys) {
            this.emojiKeys = new Array<string>()
           const keys = this.emojiMap.keys()
           for (let emojiKey of keys) {
                this.emojiKeys.push(emojiKey)
           }
        }
        return new RegExp(`(${this.emojiKeys.join("|")})`)
    }

    // emojiValueMap: any = null  // 倒过来的emojiMap
    getImage(emojiName: string): string {
        // if (!this.emojiValueMap) {
        //     this.emojiValueMap = {}
        //     let emojis = this.emojiMap.entries()
        //     for (let [emojiKey, emojiValue] of emojis) {
        //         this.emojiValueMap[emojiValue || ""] = emojiKey;
        //     }
        //     // for (let index = 0; index < emojiKeys.length; index++) {
        //     //     let emojiKey = emojiKeys[index];


        //     // }
        // }
        // console.log("emojiValueMap--->",this.emojiValueMap)
        
        let name = this.emojiMap.get(emojiName);
        if (!name) {
            return "";
        }
        return this.getImageWithEmoji(emojiName);
    }
    private getImageWithEmoji(emoji: string): string {
        if (!emoji) {
            return "";
        }
        const codePoints = Array.from(emoji)
            .map((char) => char.codePointAt(0)?.toString(16))
            .filter((cp): cp is string => !!cp && cp !== "fe0f");
        const file = `${codePoints.join("-")}.png`
        // 默认优先走公共 CDN：表情 PNG 是静态资源，直连 jsDelivr 可以规避「API 所在服务器出网被墙 → 服务端代理 404」的常见问题。
        // 受限网络环境（内网）可通过 REACT_APP_TWEMOJI_BASE 指向自建镜像；仍未配置时再回落到 API 代理 /v1/common/twemoji72/。
        const override = (process.env.REACT_APP_TWEMOJI_BASE || "").trim()
        if (override) {
            const base = override.replace(/\/?$/, "/")
            return `${base}${file}`
        }
        const publicCDN = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/"
        // 同源/同域部署下，直连 CDN 成功率远高于服务端代理；仅当明确禁用 CDN 时才走后端代理。
        if (process.env.REACT_APP_TWEMOJI_USE_SERVER_PROXY === "1") {
            const apiBase = (APIClient.shared.config.apiURL || "").trim()
            if (apiBase) {
                return joinApiResourceUrl(apiBase, `common/twemoji72/${file}`)
            }
        }
        return `${publicCDN}${file}`
    }
    getAllEmoji(): Emoji[] {
        const emojis = new Array<Emoji>();
        let emojiKeys = this.emojiMap.keys()
        // emojiKeys.sort((a, b) => {

        //     return parseInt(a) - parseInt(b)
        // })
        for (const emojiKey of emojiKeys) {
            const emojiName = this.emojiMap.get(emojiKey)
            const emojiImage = this.getImageWithEmoji(emojiKey)
            emojis.push(new Emoji(emojiKey, emojiName || "", emojiImage))
        }
        // console.log("emojiKeys--->",emojiKeys)
        // for (let i = 0; i < emojiKeys.length; i++) {
        //     const emojiKey = emojiKeys[i];
        //     const emojiName = this.emojiMap[emojiKeys[i]]
        //     const emojiPath = this.getPathWithKey(emojiKey)
        //     emojis.push(new Emoji(emojiKey, emojiName, emojiPath))
        // }
        return emojis
    }

}