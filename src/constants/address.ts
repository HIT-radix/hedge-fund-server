import * as dotenv from "dotenv";
dotenv.config();

export const DAPP_DEFINITION_ADDRESS =
  process.env.ENVIRONMENT === "dev"
    ? "account_tdx_2_129zymzhffm45w5jyccyu9x0tv5xs7qs76zxzrfsd7gn76f7k5reus2"
    : "account_rdx128er8y5hetcj98krndumys93jyerq659ug0uyk6l6ljdtd9mrcevwf";

export const NODE_STAKING_COMPONENT_ADDRESS =
  process.env.ENVIRONMENT === "dev"
    ? "component_tdx_2_1crf2uqm3tcqqdml0tqq04wurmqrhdkca7cscsuxr45lghhvv72zgnx"
    : "component_rdx1cqpv4nfsgfk9c2r9ymnqyksfkjsg07mfc49m9qw3dpgzrmjmsuuquv";

export const NODE_STAKING_USER_BADGE_ADDRESS =
  "resource_rdx1ntmkq3eddym9lzppx8sg2elpqwexhsppcdscwu5s7ca5u79hcaztu3";

export const HIT_FOMO_NODE_LSU_ADDRESS =
  process.env.ENVIRONMENT === "dev"
    ? "resource_tdx_2_1thrg4addeue0w87wksukm86updhptw9zr7z4xlrjpecltgpfpxhxce"
    : "resource_rdx1t4d3ka2x2j35e30gh75j6hma6fccwdsft88h2v2ul4qmqshnwjmxf7";

export const XRD_RESOURCE_ADDRESS =
  process.env.ENVIRONMENT === "dev"
    ? "resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc"
    : "resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd";

export const FUND_MANAGER_COMPONENT =
  process.env.ENVIRONMENT === "dev"
    ? "component_tdx_2_1cqn24ymyzqst9zgf6cx2dzp0464nffmqdax272h9hzmj756fqfk503"
    : "component_rdx1cqn24ymyzqst9zgf6cx2dzp0464nffmqdax272h9hzmj756fqfk503";

export const FUND_BOT_BADGE =
  process.env.ENVIRONMENT === "dev"
    ? "resource_tdx_2_1thlu6g2lc0d0852lpce9qdaadvr709u58d8fr607vg8qku3ue0swe9"
    : "resource_tdx_2_1thlu6g2lc0d0852lpce9qdaadvr709u58d8fr607vg8qku3ue0swe9";

export const VALIDATOR_ADDRESS =
  process.env.ENVIRONMENT === "dev"
    ? "validator_tdx_2_1svff7mkddhm9dy325f3ckx72cxqsl49ewy74667pchqfkxl7wxpa8r"
    : "validator_rdx1swez5cqmw4d6tls0mcldehnfhpxge0mq7cmnypnjz909apqqjgx6n9";
