const WEATHER_PROVINCES = [
  {
    name: '自动定位', cities: [
      { name: '自动定位', query: '' }
    ]
  },
  {
    name: '北京', cities: [
      { name: '北京', query: 'Beijing' }
    ]
  },
  {
    name: '天津', cities: [
      { name: '天津', query: 'Tianjin' }
    ]
  },
  {
    name: '上海', cities: [
      { name: '上海', query: 'Shanghai' }
    ]
  },
  {
    name: '重庆', cities: [
      { name: '重庆', query: 'Chongqing' }
    ]
  },
  {
    name: '广东', cities: [
      { name: '广州', query: 'Guangzhou' },
      { name: '深圳', query: 'Shenzhen' },
      { name: '东莞', query: 'Dongguan' },
      { name: '佛山', query: 'Foshan' },
      { name: '珠海', query: 'Zhuhai' },
      { name: '中山', query: 'Zhongshan' },
      { name: '惠州', query: 'Huizhou' },
      { name: '汕头', query: 'Shantou' },
      { name: '江门', query: 'Jiangmen' },
      { name: '肇庆', query: 'Zhaoqing' },
      { name: '湛江', query: 'Zhanjiang' },
      { name: '茂名', query: 'Maoming' },
      { name: '韶关', query: 'Shaoguan' },
      { name: '梅州', query: 'Meizhou' },
      { name: '汕尾', query: 'Shanwei' },
      { name: '河源', query: 'Heyuan' },
      { name: '阳江', query: 'Yangjiang' },
      { name: '清远', query: 'Qingyuan' },
      { name: '潮州', query: 'Chaozhou' },
      { name: '揭阳', query: 'Jieyang' },
      { name: '云浮', query: 'Yunfu' }
    ]
  },
  {
    name: '浙江', cities: [
      { name: '杭州', query: 'Hangzhou' },
      { name: '宁波', query: 'Ningbo' },
      { name: '温州', query: 'Wenzhou' },
      { name: '嘉兴', query: 'Jiaxing' },
      { name: '绍兴', query: 'Shaoxing' },
      { name: '湖州', query: 'Huzhou' },
      { name: '金华', query: 'Jinhua' },
      { name: '衢州', query: 'Quzhou' },
      { name: '舟山', query: 'Zhoushan' },
      { name: '台州', query: 'Taizhou' },
      { name: '丽水', query: 'Lishui' }
    ]
  },
  {
    name: '江苏', cities: [
      { name: '南京', query: 'Nanjing' },
      { name: '苏州', query: 'Suzhou' },
      { name: '无锡', query: 'Wuxi' },
      { name: '常州', query: 'Changzhou' },
      { name: '南通', query: 'Nantong' },
      { name: '徐州', query: 'Xuzhou' },
      { name: '扬州', query: 'Yangzhou' },
      { name: '盐城', query: 'Yancheng' },
      { name: '淮安', query: "Huai'an" },
      { name: '连云港', query: 'Lianyungang' },
      { name: '镇江', query: 'Zhenjiang' },
      { name: '泰州', query: 'Taizhou+Jiangsu' },
      { name: '宿迁', query: 'Suqian' }
    ]
  },
  {
    name: '福建', cities: [
      { name: '福州', query: 'Fuzhou' },
      { name: '厦门', query: 'Xiamen' },
      { name: '泉州', query: 'Quanzhou' },
      { name: '漳州', query: 'Zhangzhou' },
      { name: '莆田', query: 'Putian' },
      { name: '龙岩', query: 'Longyan' },
      { name: '三明', query: 'Sanming' },
      { name: '南平', query: 'Nanping' },
      { name: '宁德', query: 'Ningde' }
    ]
  },
  {
    name: '山东', cities: [
      { name: '济南', query: 'Jinan' },
      { name: '青岛', query: 'Qingdao' },
      { name: '烟台', query: 'Yantai' },
      { name: '潍坊', query: 'Weifang' },
      { name: '临沂', query: 'Linyi' },
      { name: '济宁', query: 'Jining' },
      { name: '淄博', query: 'Zibo' },
      { name: '泰安', query: "Tai'an" },
      { name: '德州', query: 'Dezhou' },
      { name: '威海', query: 'Weihai' },
      { name: '聊城', query: 'Liaocheng' },
      { name: '滨州', query: 'Binzhou' },
      { name: '菏泽', query: 'Heze' },
      { name: '日照', query: 'Rizhao' },
      { name: '枣庄', query: 'Zaozhuang' },
      { name: '东营', query: 'Dongying' }
    ]
  },
  {
    name: '四川', cities: [
      { name: '成都', query: 'Chengdu' },
      { name: '绵阳', query: 'Mianyang' },
      { name: '德阳', query: 'Deyang' },
      { name: '宜宾', query: 'Yibin' },
      { name: '南充', query: 'Nanchong' },
      { name: '泸州', query: 'Luzhou' },
      { name: '达州', query: 'Dazhou' },
      { name: '乐山', query: 'Leshan' },
      { name: '攀枝花', query: 'Panzhihua' },
      { name: '内江', query: 'Neijiang' },
      { name: '自贡', query: 'Zigong' },
      { name: '眉山', query: 'Meishan' },
      { name: '广元', query: 'Guangyuan' },
      { name: '遂宁', query: 'Suining' },
      { name: '广安', query: "Guang'an" },
      { name: '资阳', query: 'Ziyang' },
      { name: '巴中', query: 'Bazhong' },
      { name: '雅安', query: 'Yaan' },
      { name: '西昌', query: 'Xichang' }
    ]
  },
  {
    name: '湖北', cities: [
      { name: '武汉', query: 'Wuhan' },
      { name: '宜昌', query: 'Yichang' },
      { name: '襄阳', query: 'Xiangyang' },
      { name: '荆州', query: 'Jingzhou' },
      { name: '黄石', query: 'Huangshi' },
      { name: '十堰', query: 'Shiyan' },
      { name: '孝感', query: 'Xiaogan' },
      { name: '荆门', query: 'Jingmen' },
      { name: '鄂州', query: 'Ezhou' },
      { name: '黄冈', query: 'Huanggang' },
      { name: '咸宁', query: 'Xianning' },
      { name: '随州', query: 'Suizhou' },
      { name: '恩施', query: 'Enshi' }
    ]
  },
  {
    name: '湖南', cities: [
      { name: '长沙', query: 'Changsha' },
      { name: '株洲', query: 'Zhuzhou' },
      { name: '湘潭', query: 'Xiangtan' },
      { name: '衡阳', query: 'Hengyang' },
      { name: '岳阳', query: 'Yueyang' },
      { name: '常德', query: 'Changde' },
      { name: '益阳', query: 'Yiyang' },
      { name: '郴州', query: 'Chenzhou' },
      { name: '邵阳', query: 'Shaoyang' },
      { name: '怀化', query: 'Huaihua' },
      { name: '永州', query: 'Yongzhou' },
      { name: '娄底', query: 'Loudi' },
      { name: '湘西', query: 'Xiangxi' },
      { name: '张家界', query: 'Zhangjiajie' }
    ]
  },
  {
    name: '河南', cities: [
      { name: '郑州', query: 'Zhengzhou' },
      { name: '洛阳', query: 'Luoyang' },
      { name: '开封', query: 'Kaifeng' },
      { name: '南阳', query: 'Nanyang' },
      { name: '许昌', query: 'Xuchang' },
      { name: '周口', query: 'Zhoukou' },
      { name: '新乡', query: 'Xinxiang' },
      { name: '安阳', query: 'Anyang' },
      { name: '平顶山', query: 'Pingdingshan' },
      { name: '信阳', query: 'Xinyang' },
      { name: '驻马店', query: 'Zhumadian' },
      { name: '商丘', query: 'Shangqiu' },
      { name: '焦作', query: 'Jiaozuo' },
      { name: '濮阳', query: 'Puyang' },
      { name: '漯河', query: 'Luohe' },
      { name: '三门峡', query: 'Sanmenxia' },
      { name: '鹤壁', query: 'Hebi' },
      { name: '济源', query: 'Jiyuan' }
    ]
  },
  {
    name: '河北', cities: [
      { name: '石家庄', query: 'Shijiazhuang' },
      { name: '唐山', query: 'Tangshan' },
      { name: '保定', query: 'Baoding' },
      { name: '邯郸', query: 'Handan' },
      { name: '沧州', query: 'Cangzhou' },
      { name: '廊坊', query: 'Langfang' },
      { name: '邢台', query: 'Xingtai' },
      { name: '秦皇岛', query: 'Qinhuangdao' },
      { name: '张家口', query: 'Zhangjiakou' },
      { name: '承德', query: 'Chengde' },
      { name: '衡水', query: 'Hengshui' }
    ]
  },
  {
    name: '陕西', cities: [
      { name: '西安', query: "Xian" },
      { name: '咸阳', query: 'Xianyang' },
      { name: '宝鸡', query: 'Baoji' },
      { name: '渭南', query: 'Weinan' },
      { name: '延安', query: "Yan'an" },
      { name: '汉中', query: 'Hanzhong' },
      { name: '榆林', query: 'Yulin' },
      { name: '安康', query: 'Ankang' },
      { name: '商洛', query: 'Shangluo' },
      { name: '铜川', query: 'Tongchuan' }
    ]
  },
  {
    name: '辽宁', cities: [
      { name: '沈阳', query: 'Shenyang' },
      { name: '大连', query: 'Dalian' },
      { name: '鞍山', query: 'Anshan' },
      { name: '抚顺', query: 'Fushun' },
      { name: '本溪', query: 'Benxi' },
      { name: '丹东', query: 'Dandong' },
      { name: '锦州', query: 'Jinzhou' },
      { name: '营口', query: 'Yingkou' },
      { name: '阜新', query: 'Fuxin' },
      { name: '辽阳', query: 'Liaoyang' },
      { name: '朝阳', query: 'Chaoyang+Liaoning' },
      { name: '盘锦', query: 'Panjin' },
      { name: '葫芦岛', query: 'Huludao' },
      { name: '铁岭', query: 'Tieling' }
    ]
  },
  {
    name: '云南', cities: [
      { name: '昆明', query: 'Kunming' },
      { name: '大理', query: 'Dali' },
      { name: '丽江', query: 'Lijiang' },
      { name: '曲靖', query: 'Qujing' },
      { name: '红河', query: 'Honghe' },
      { name: '玉溪', query: 'Yuxi' },
      { name: '楚雄', query: 'Chuxiong' },
      { name: '昭通', query: 'Zhaotong' },
      { name: '文山', query: 'Wenshan' },
      { name: '普洱', query: "Pu'er" },
      { name: '保山', query: 'Baoshan' },
      { name: '西双版纳', query: 'Xishuangbanna' },
      { name: '德宏', query: 'Dehong' },
      { name: '怒江', query: 'Nujiang' },
      { name: '迪庆', query: 'Diqing' }
    ]
  },
  {
    name: '贵州', cities: [
      { name: '贵阳', query: 'Guiyang' },
      { name: '遵义', query: 'Zunyi' },
      { name: '六盘水', query: 'Liupanshui' },
      { name: '安顺', query: 'Anshun' },
      { name: '毕节', query: 'Bijie' },
      { name: '铜仁', query: 'Tongren' },
      { name: '黔东南', query: 'Qiandongnan' },
      { name: '黔南', query: 'Qiannan' },
      { name: '黔西南', query: 'Qianxinan' }
    ]
  },
  {
    name: '广西', cities: [
      { name: '南宁', query: 'Nanning' },
      { name: '桂林', query: 'Guilin' },
      { name: '柳州', query: 'Liuzhou' },
      { name: '北海', query: 'Beihai' },
      { name: '梧州', query: 'Wuzhou' },
      { name: '玉林', query: 'Yulin+Guangxi' },
      { name: '钦州', query: 'Qinzhou' },
      { name: '百色', query: 'Baise' },
      { name: '河池', query: 'Hechi' },
      { name: '贵港', query: 'Guigang' },
      { name: '贺州', query: 'Hezhou' },
      { name: '防城港', query: 'Fangchenggang' },
      { name: '来宾', query: 'Laibin' },
      { name: '崇左', query: 'Chongzuo' }
    ]
  },
  {
    name: '安徽', cities: [
      { name: '合肥', query: 'Hefei' },
      { name: '芜湖', query: 'Wuhu' },
      { name: '黄山', query: 'Huangshan' },
      { name: '蚌埠', query: 'Bengbu' },
      { name: '马鞍山', query: "Ma'anshan" },
      { name: '安庆', query: 'Anqing' },
      { name: '滁州', query: 'Chuzhou' },
      { name: '阜阳', query: 'Fuyang' },
      { name: '六安', query: "Lu'an" },
      { name: '铜陵', query: 'Tongling' },
      { name: '宣城', query: 'Xuancheng' },
      { name: '池州', query: 'Chizhou' },
      { name: '亳州', query: 'Bozhou' },
      { name: '淮南', query: 'Huainan' },
      { name: '淮北', query: 'Huaibei' },
      { name: '宿州', query: 'Suzhou+Anhui' }
    ]
  },
  {
    name: '江西', cities: [
      { name: '南昌', query: 'Nanchang' },
      { name: '九江', query: 'Jiujiang' },
      { name: '赣州', query: 'Ganzhou' },
      { name: '景德镇', query: 'Jingdezhen' },
      { name: '萍乡', query: 'Pingxiang' },
      { name: '上饶', query: 'Shangrao' },
      { name: '宜春', query: 'Yichun' },
      { name: '吉安', query: "Ji'an" },
      { name: '抚州', query: 'Fuzhou+Jiangxi' },
      { name: '鹰潭', query: 'Yingtan' },
      { name: '新余', query: 'Xinyu' }
    ]
  },
  {
    name: '黑龙江', cities: [
      { name: '哈尔滨', query: 'Harbin' },
      { name: '大庆', query: 'Daqing' },
      { name: '齐齐哈尔', query: 'Qiqihar' },
      { name: '牡丹江', query: 'Mudanjiang' },
      { name: '佳木斯', query: 'Jiamusi' },
      { name: '绥化', query: 'Suihua' },
      { name: '黑河', query: 'Heihe' },
      { name: '鸡西', query: 'Jixi' },
      { name: '双鸭山', query: 'Shuangyashan' },
      { name: '鹤岗', query: 'Hegang' },
      { name: '伊春', query: 'Yichun+Heilongjiang' },
      { name: '七台河', query: 'Qitaihe' },
      { name: '大兴安岭', query: "Daxing'anling" }
    ]
  },
  {
    name: '吉林', cities: [
      { name: '长春', query: 'Changchun' },
      { name: '吉林市', query: 'Jilin' },
      { name: '四平', query: 'Siping' },
      { name: '通化', query: 'Tonghua' },
      { name: '松原', query: 'Songyuan' },
      { name: '辽源', query: 'Liaoyuan' },
      { name: '白山', query: 'Baishan' },
      { name: '白城', query: 'Baicheng' },
      { name: '延边', query: 'Yanbian' }
    ]
  },
  {
    name: '山西', cities: [
      { name: '太原', query: 'Taiyuan' },
      { name: '大同', query: 'Datong' },
      { name: '临汾', query: 'Linfen' },
      { name: '运城', query: 'Yuncheng' },
      { name: '晋中', query: 'Jinzhong' },
      { name: '长治', query: 'Changzhi' },
      { name: '吕梁', query: 'Lvliang' },
      { name: '晋城', query: 'Jincheng' },
      { name: '忻州', query: 'Xinzhou' },
      { name: '朔州', query: 'Shuozhou' },
      { name: '阳泉', query: 'Yangquan' }
    ]
  },
  {
    name: '甘肃', cities: [
      { name: '兰州', query: 'Lanzhou' },
      { name: '天水', query: 'Tianshui' },
      { name: '酒泉', query: 'Jiuquan' },
      { name: '嘉峪关', query: 'Jiayuguan' },
      { name: '武威', query: 'Wuwei' },
      { name: '张掖', query: 'Zhangye' },
      { name: '庆阳', query: 'Qingyang' },
      { name: '平凉', query: 'Pingliang' },
      { name: '定西', query: 'Dingxi' },
      { name: '陇南', query: 'Longnan' },
      { name: '白银', query: 'Baiyin' },
      { name: '临夏', query: 'Linxia' },
      { name: '甘南', query: 'Gannan' },
      { name: '敦煌', query: 'Dunhuang' }
    ]
  },
  {
    name: '海南', cities: [
      { name: '海口', query: 'Haikou' },
      { name: '三亚', query: 'Sanya' },
      { name: '儋州', query: 'Danzhou' },
      { name: '文昌', query: 'Wenchang' },
      { name: '琼海', query: 'Qionghai' },
      { name: '万宁', query: 'Wanning' },
      { name: '五指山', query: 'Wuzhishan' },
      { name: '东方', query: 'Dongfang' },
      { name: '陵水', query: 'Lingshui' },
      { name: '乐东', query: 'Ledong' }
    ]
  },
  {
    name: '内蒙古', cities: [
      { name: '呼和浩特', query: 'Hohhot' },
      { name: '包头', query: 'Baotou' },
      { name: '赤峰', query: 'Chifeng' },
      { name: '通辽', query: 'Tongliao' },
      { name: '鄂尔多斯', query: 'Ordos' },
      { name: '呼伦贝尔', query: 'Hulunbuir' },
      { name: '巴彦淖尔', query: 'Bayan+Nur' },
      { name: '乌兰察布', query: 'Ulanqab' },
      { name: '兴安盟', query: "Xing'an" },
      { name: '锡林郭勒', query: 'Xilin+Gol' },
      { name: '阿拉善盟', query: 'Alxa' },
      { name: '乌海', query: 'Wuhai' }
    ]
  },
  {
    name: '新疆', cities: [
      { name: '乌鲁木齐', query: 'Urumqi' },
      { name: '喀什', query: 'Kashgar' },
      { name: '伊犁', query: 'Yili' },
      { name: '阿克苏', query: 'Aksu+China' },
      { name: '吐鲁番', query: 'Turpan' },
      { name: '哈密', query: 'Hami' },
      { name: '克拉玛依', query: 'Karamay' },
      { name: '和田', query: 'Hotan' },
      { name: '昌吉', query: 'Changji' },
      { name: '库尔勒', query: 'Korla' },
      { name: '阿勒泰', query: 'Altay+Xinjiang' }
    ]
  },
  {
    name: '西藏', cities: [
      { name: '拉萨', query: 'Lhasa' },
      { name: '日喀则', query: 'Shigatse' },
      { name: '昌都', query: 'Chamdo' },
      { name: '林芝', query: 'Nyingchi' },
      { name: '山南', query: 'Shannan' },
      { name: '那曲', query: 'Nagqu' },
      { name: '阿里', query: 'Ngari' }
    ]
  },
  {
    name: '宁夏', cities: [
      { name: '银川', query: 'Yinchuan' },
      { name: '石嘴山', query: 'Shizuishan' },
      { name: '吴忠', query: 'Wuzhong' },
      { name: '固原', query: 'Guyuan' },
      { name: '中卫', query: 'Zhongwei' }
    ]
  },
  {
    name: '青海', cities: [
      { name: '西宁', query: 'Xining' },
      { name: '海东', query: 'Haidong' },
      { name: '格尔木', query: 'Golmud' },
      { name: '玉树', query: 'Yushu' },
      { name: '海西', query: 'Haixi' }
    ]
  },
  {
    name: '港澳台', cities: [
      { name: '香港', query: 'Hong+Kong' },
      { name: '澳门', query: 'Macau' },
      { name: '台北', query: 'Taipei' },
      { name: '高雄', query: 'Kaohsiung' },
      { name: '台中', query: 'Taichung' },
      { name: '台南', query: 'Tainan' }
    ]
  }
];

const WEATHER_CODE_MAP = {
  113: { icon: '☀️', text: '晴' },
  116: { icon: '⛅', text: '多云' },
  119: { icon: '☁️', text: '阴天' },
  122: { icon: '☁️', text: '阴' },
  143: { icon: '🌫️', text: '雾' },
  176: { icon: '🌦️', text: '小雨' },
  179: { icon: '🌧️', text: '雨' },
  182: { icon: '🌧️', text: '雨' },
  185: { icon: '🌧️', text: '雨' },
  200: { icon: '⛈️', text: '雷暴' },
  227: { icon: '🌨️', text: '雪' },
  230: { icon: '🌨️', text: '暴雪' },
  248: { icon: '🌫️', text: '雾' },
  260: { icon: '🌫️', text: '雾' },
  263: { icon: '🌦️', text: '小雨' },
  266: { icon: '🌦️', text: '雨' },
  281: { icon: '🌧️', text: '雨' },
  284: { icon: '🌧️', text: '雨' },
  293: { icon: '🌦️', text: '小雨' },
  296: { icon: '🌦️', text: '小雨' },
  299: { icon: '🌧️', text: '中雨' },
  302: { icon: '🌧️', text: '中雨' },
  305: { icon: '🌧️', text: '大雨' },
  308: { icon: '🌧️', text: '大雨' },
  311: { icon: '🌧️', text: '雨' },
  314: { icon: '🌧️', text: '雨' },
  317: { icon: '🌧️', text: '雨' },
  320: { icon: '🌨️', text: '雨夹雪' },
  323: { icon: '🌨️', text: '雪' },
  326: { icon: '🌨️', text: '小雪' },
  329: { icon: '🌨️', text: '中雪' },
  332: { icon: '🌨️', text: '大雪' },
  335: { icon: '🌨️', text: '大雪' },
  338: { icon: '🌨️', text: '暴雪' },
  350: { icon: '🧊', text: '冰雹' },
  353: { icon: '🌦️', text: '小雨' },
  356: { icon: '🌧️', text: '中雨' },
  359: { icon: '🌧️', text: '大雨' },
  362: { icon: '🌧️', text: '雨' },
  365: { icon: '🌧️', text: '雨' },
  368: { icon: '🌨️', text: '小雪' },
  371: { icon: '🌨️', text: '大雪' },
  374: { icon: '🧊', text: '冰雹' },
  377: { icon: '🧊', text: '冰雹' },
  386: { icon: '⛈️', text: '雷暴' },
  389: { icon: '⛈️', text: '雷暴' },
  392: { icon: '⛈️', text: '雷阵雪' },
  395: { icon: '⛈️', text: '雷暴' }
};

const CACHE_DURATION = 30 * 60 * 1000;
const CACHE_VERSION = 7;

function findCityByQuery(query) {
  for (const prov of WEATHER_PROVINCES) {
    const city = prov.cities.find(c => c.query === query);
    if (city) return { province: prov.name, city: city };
  }
  return null;
}

function parseWttrTime(t) {
  const n = parseInt(t, 10);
  return Math.floor(n / 100);
}

function mapCode(code) {
  return WEATHER_CODE_MAP[code] || { icon: '🌤️', text: '' };
}

function buildHourly24(weatherDays) {
  if (!Array.isArray(weatherDays) || weatherDays.length === 0) return null;
  const points = [];
  const now = new Date();
  const startHour = now.getHours();

  for (let d = 0; d < weatherDays.length && points.length < 12; d++) {
    const day = weatherDays[d];
    if (!day || !Array.isArray(day.hourly)) continue;
    for (const h of day.hourly) {
      const hour = parseWttrTime(h.time);
      if (d === 0 && hour < startHour) continue;
      points.push({
        hour,
        dayOffset: d,
        tempC: parseFloat(h.tempC),
        chanceofrain: parseFloat(h.chanceofrain || '0'),
        code: parseInt(h.weatherCode, 10)
      });
      if (points.length >= 12) break;
    }
  }

  if (points.length < 2) return null;

  const result = [];
  for (let i = 0; i < 24; i++) {
    const targetHour = (startHour + i) % 24;
    const targetDayOffset = Math.floor((startHour + i) / 24);
    const targetKey = targetDayOffset * 24 + targetHour;

    let prev = points[0];
    let next = points[points.length - 1];
    for (let j = 0; j < points.length; j++) {
      const pKey = points[j].dayOffset * 24 + points[j].hour;
      if (pKey <= targetKey) prev = points[j];
      if (pKey >= targetKey) { next = points[j]; break; }
    }
    const prevKey = prev.dayOffset * 24 + prev.hour;
    const nextKey = next.dayOffset * 24 + next.hour;
    const span = nextKey - prevKey;
    const ratio = span === 0 ? 0 : (targetKey - prevKey) / span;

    const temp = prev.tempC + (next.tempC - prev.tempC) * ratio;
    const rain = prev.chanceofrain + (next.chanceofrain - prev.chanceofrain) * ratio;
    const code = ratio < 0.5 ? prev.code : next.code;
    const mapped = mapCode(code);

    result.push({
      hour: targetHour,
      temp: Math.round(temp),
      rain: Math.round(rain),
      icon: mapped.icon
    });
  }
  return result;
}

const Weather = {
  cache: null,
  coords: null,
  selectedCityQuery: '',

  async init() {
    const settings = await Storage.getSettings();
    this.selectedCityQuery = settings.weatherCity || '';
    if (settings.weatherCache) {
      this.cache = settings.weatherCache;
      this.render();
    }
    await this.detectLocation();
    await this.refresh();
    setInterval(() => this.refresh(), CACHE_DURATION);
  },

  async setCity(query) {
    this.selectedCityQuery = query;
    this.cache = null;
    await Storage.updateSettings({ weatherCity: query, weatherCache: null });
    await this.refresh();
  },

  detectLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve();
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.coords = {
            lat: pos.coords.latitude.toFixed(2),
            lng: pos.coords.longitude.toFixed(2)
          };
          resolve();
        },
        () => {
          resolve();
        },
        { timeout: 5000, enableHighAccuracy: false }
      );
    });
  },

  async fetchWeather(retries = 2) {
    let url;
    if (this.selectedCityQuery) {
      url = `https://wttr.in/${this.selectedCityQuery}?format=j1&lang=zh`;
    } else if (this.coords) {
      url = `https://wttr.in/${this.coords.lat},${this.coords.lng}?format=j1&lang=zh`;
    } else {
      url = 'https://wttr.in/?format=j1&lang=zh';
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error('Weather fetch failed');
        const data = await response.json();
        const current = data.current_condition[0];
        const code = parseInt(current.weatherCode, 10);
        const mapped = WEATHER_CODE_MAP[code] || { icon: '🌤️', text: current.weatherDesc[0].value };

        const hourly = buildHourly24(data.weather);
        const today = Array.isArray(data.weather) && data.weather[0] ? data.weather[0] : null;
        const todayHigh = today ? parseInt(today.maxtempC, 10) : null;
        const todayLow = today ? parseInt(today.mintempC, 10) : null;

        return {
          temp: current.temp_C,
          icon: mapped.icon,
          desc: mapped.text,
          hourly,
          todayHigh,
          todayLow,
          timestamp: Date.now(),
          version: CACHE_VERSION
        };
      } catch {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }
    }
    return null;
  },

  getDisplayCity() {
    if (!this.selectedCityQuery) return '';
    const match = findCityByQuery(this.selectedCityQuery);
    if (!match) return '';
    const province = match.province;
    const cityName = match.city.name;
    if (province === '港澳台' || province === '北京' || province === '天津' || province === '上海' || province === '重庆') {
      return cityName;
    }
    return `${province} · ${cityName}`;
  },

  async refresh() {
    const data = await this.fetchWeather();
    if (data) {
      this.cache = data;
      await Storage.updateSettings({ weatherCache: data });
    }
    this.render();
  },

  render() {
    const el = document.getElementById('weatherWidget');
    if (!el) return;
    if (!this.cache) {
      const offline = !navigator.onLine;
      el.innerHTML = offline
        ? '<span class="weather-loading">离线</span>'
        : '<span class="weather-loading">获取天气中...</span>';
      return;
    }
    const display = this.getDisplayCity();
    const loc = display ? `<span class="weather-sep">|</span><span class="weather-desc">${display}</span>` : '';
    el.innerHTML = `
      <span class="weather-icon">${this.cache.icon}</span>
      <span class="weather-temp">${this.cache.temp}°C</span>
      <span class="weather-sep">|</span>
      <span class="weather-desc">${this.cache.desc}</span>
      ${loc}
      ${this.renderHoverCard()}
    `;
  },

  renderHoverCard() {
    const hourly = this.cache && this.cache.hourly;
    if (!hourly || hourly.length === 0) return '';

    const display = this.getDisplayCity();
    const high = this.cache.todayHigh;
    const low = this.cache.todayLow;
    const range = (high != null && low != null) ? `今日 ${low}° ~ ${high}°` : '';
    const header = [display, range].filter(Boolean).join(' &middot; ');

    const bars = hourly.map((h, idx) => {
      const showLabel = idx === 0 || idx % 3 === 0;
      const showIcon = idx === 0 || idx % 3 === 0;
      const heightPct = Math.max(6, h.rain);
      const opacity = 0.35 + (h.rain / 100) * 0.65;
      const hourLabel = idx === 0 ? '现在' : String(h.hour).padStart(2, '0');
      const nowClass = idx === 0 ? ' whc-now' : '';
      return `
        <div class="whc-col${nowClass}">
          <div class="whc-icon">${showIcon ? h.icon : ''}</div>
          <div class="whc-temp">${showIcon ? h.temp + '°' : ''}</div>
          <div class="whc-bar-wrap">
            <div class="whc-bar" style="height:${heightPct}%; opacity:${opacity.toFixed(2)}"></div>
          </div>
          <div class="whc-hour">${showLabel ? hourLabel : ''}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="weather-hover-card" role="tooltip">
        <div class="whc-header">${header}</div>
        <div class="whc-grid">${bars}</div>
      </div>
    `;
  }
};
