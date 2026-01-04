import * as dotenv from "dotenv";
dotenv.config();

export const XRD_RESOURCE_ADDRESS =
  process.env.ENVIRONMENT === "dev"
    ? "resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc"
    : "resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd";

export const VALIDATOR_ADDRESS =
  process.env.ENVIRONMENT === "dev"
    ? "validator_tdx_2_1svff7mkddhm9dy325f3ckx72cxqsl49ewy74667pchqfkxl7wxpa8r"
    : "validator_rdx1swez5cqmw4d6tls0mcldehnfhpxge0mq7cmnypnjz909apqqjgx6n9";

export const HIT_FOMO_NODE_LSU_ADDRESS =
  process.env.ENVIRONMENT === "dev"
    ? "resource_tdx_2_1thrg4addeue0w87wksukm86updhptw9zr7z4xlrjpecltgpfpxhxce"
    : "resource_rdx1t4d3ka2x2j35e30gh75j6hma6fccwdsft88h2v2ul4qmqshnwjmxf7";

export const FUND_MANAGER_COMPONENT =
  process.env.ENVIRONMENT === "dev"
    ? "component_tdx_2_1cpdhxgf8nmvzczs9ttvaf3307lq8m4wdky66rpn4zy5qdaat0av5sg"
    : "component_rdx1cqpv4nfsgfk9c2r9ymnqyksfkjsg07mfc49m9qw3dpgzrmjmsuuquv";

export const FUND_BOT_BADGE =
  process.env.ENVIRONMENT === "dev"
    ? "resource_tdx_2_1t40pyc05pfmsqvslxpnystfyxe654h856r049gfxc009cjrp6kluta"
    : "resource_rdx1t5s0qfsgsfhlf8q3sutt8j500dk2el4p3dk4psxyagqxdfwuhrm56k";

export const NODE_CLAIM_NFT_ADDRESS =
  process.env.ENVIRONMENT === "dev"
    ? "resource_rdx1ngyn7ea28quxf44fsg4hxq6q6fhah2lwh5t32sarglygp9xl76c4tz"
    : "resource_rdx1ngyn7ea28quxf44fsg4hxq6q6fhah2lwh5t32sarglygp9xl76c4tz";

export const FUND_UNIT_RESOURCE_ADDRESS =
  process.env.ENVIRONMENT === "dev"
    ? "resource_tdx_2_1t4ny2slhdk7dgshdaxggs3efddfp8j3uf838km74fcys9f8lwttd3n"
    : "resource_rdx1t5s0qfsgsfhlf8q3sutt8j500dk2el4p3dk4psxyagqxdfwuhrm56k";

export const ACCOUNT_LOCKER_ADDRESS =
  process.env.ENVIRONMENT === "dev"
    ? "locker_tdx_2_1dq0rslnp945vc3p75lxgvnd8ph2qfr43am3srus8q352572ckpdl4w"
    : "locker_rdx1drxckgmq4wqdh8zvs64dz2065wq4e9q8gfj7kkc8vehnwcxp0lu94d";

export const DAPP_DEFINITION_ADDRESS =
  process.env.ENVIRONMENT === "dev"
    ? "account_tdx_2_129zymzhffm45w5jyccyu9x0tv5xs7qs76zxzrfsd7gn76f7k5reus2"
    : "account_rdx128er8y5hetcj98krndumys93jyerq659ug0uyk6l6ljdtd9mrcevwf";

export const MORPHER_ORACLE_NFT_ID =
  process.env.ENVIRONMENT === "dev"
    ? "{cfd5d86c9d43b11e-78622846f264c0a0-e5256cd3fdb3a1e4-1e648e9bb24ca5de}"
    : "{a1dcb97c000ff3fe-9803f2e065d3cd34-222d0221f646925c-58b9f9c57ba16fbc}";

export const MORPHER_ORACLE_NFT_RESOURCE_ADDRESS =
  process.env.ENVIRONMENT === "dev"
    ? "resource_tdx_2_1nt8kpf7m6g9l0p6w6yu4jd0pc4vac564s8f20qmzf782r90fmrgrpt"
    : "resource_rdx1nfeeyrpqdkrcjmng09tdrtr6cpknlz0qadra0p3wc3ffg7p6w848gd";
