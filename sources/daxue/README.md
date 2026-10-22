# 《大学》整理记录

底本来源、固定提交、SHA-256与MIT许可见 provenance.json、daxue.original.json 及 LICENSE。按《礼记·大学》原有16段顺序，不混入朱熹重排本或格物补传。繁简转换使用 opencc-js，段题为导航自拟。

study.tsv 每行依次为零基段序、段题、完整译文、分号分隔的“原词=词注”、疑义说明。模型辅助原创整理及逐段自校，未经独立专家审校。各段保存原文、辞书核对入口和具体疑义说明；亲民/新民、格物、菉竹等不同解释保留另说。

维护时修改译稿，逐段核对引文、否定、主语、因果、多义字及论证层次，再明确更新 reviews.json 对应原文和译稿对象JSON摘要。运行 npm run build:daxue、npm run build:translations 和 npm run check。生成器不会自动批准修改，指纹或字符范围失效会阻止发布。
