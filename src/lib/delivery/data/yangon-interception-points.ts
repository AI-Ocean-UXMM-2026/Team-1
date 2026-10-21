export type InterceptionPoint = {
  id: string;
  name: string;
  township: string;
  type: "interception_midpoint" | "traffic_light" | "junction" | "bottleneck" | "bypass_waypoint";
  latitude: number;
  longitude: number;
  estimatedCycleSeconds: number;
  road?: string;
  betweenIntersections?: string;
};

/**
 * 89 Curated user-mapped interception points and corridor midpoints across Yangon
 * (Insein, North Okkalapa, Kamayut, Mayangone, Hlaing, Sanchaung, Thaketa, Kyauktada Downtown, Bahan, Yankin).
 */
export const YANGON_USER_INTERCEPTION_POINTS: readonly InterceptionPoint[] = [
  {
    "id": "pt_1792606380524_p2a5",
    "name": "Insein Interception Midpoint #1",
    "township": "North Okkalapa",
    "type": "interception_midpoint",
    "latitude": 16.88529,
    "longitude": 96.097731,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606415399_qp0f",
    "name": "North Okkalapa Interception Midpoint #2",
    "township": "North Okkalapa",
    "type": "interception_midpoint",
    "latitude": 16.905424,
    "longitude": 96.097817,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606425499_e8sz",
    "name": "Kamayut Interception Midpoint #3",
    "township": "Kamayut",
    "type": "interception_midpoint",
    "latitude": 16.933979,
    "longitude": 96.101961,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606437565_olqg",
    "name": "Kamayut Interception Midpoint #4",
    "township": "Kamayut",
    "type": "interception_midpoint",
    "latitude": 16.933333,
    "longitude": 96.087886,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606454107_hid9",
    "name": "Kamayut Interception Midpoint #6",
    "township": "Kamayut",
    "type": "interception_midpoint",
    "latitude": 16.9492,
    "longitude": 96.101017,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606467156_u5ah",
    "name": "Kamayut Interception Midpoint #7",
    "township": "Kamayut",
    "type": "interception_midpoint",
    "latitude": 16.961202,
    "longitude": 96.096892,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606477515_s3c7",
    "name": "Kamayut Interception Midpoint #8",
    "township": "Kamayut",
    "type": "interception_midpoint",
    "latitude": 16.956317,
    "longitude": 96.080967,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606488664_25kv",
    "name": "Kamayut Interception Midpoint #8",
    "township": "Kamayut",
    "type": "interception_midpoint",
    "latitude": 16.943996,
    "longitude": 96.084583,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606497224_ei5y",
    "name": "North Okkalapa Interception Midpoint #9",
    "township": "North Okkalapa",
    "type": "interception_midpoint",
    "latitude": 16.885636,
    "longitude": 96.108511,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606505940_r24n",
    "name": "Mayangone Interception Midpoint #10",
    "township": "Mayangone",
    "type": "interception_midpoint",
    "latitude": 16.878091,
    "longitude": 96.112918,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606512982_jcbh",
    "name": "Hlaing Interception Midpoint #11",
    "township": "Hlaing",
    "type": "interception_midpoint",
    "latitude": 16.86211,
    "longitude": 96.121874,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606515765_zxiy",
    "name": "Hlaing Interception Midpoint #12",
    "township": "Hlaing",
    "type": "interception_midpoint",
    "latitude": 16.85743,
    "longitude": 96.123537,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606533597_h9on",
    "name": "Kamayut Interception Midpoint #13",
    "township": "Kamayut",
    "type": "interception_midpoint",
    "latitude": 16.837153,
    "longitude": 96.12771,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606534364_d1f5",
    "name": "Kamayut Interception Midpoint #14",
    "township": "Kamayut",
    "type": "interception_midpoint",
    "latitude": 16.836706,
    "longitude": 96.12778,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606537600_ju39",
    "name": "Kamayut Interception Midpoint #15",
    "township": "Kamayut",
    "type": "interception_midpoint",
    "latitude": 16.835705,
    "longitude": 96.128048,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606544539_shmr",
    "name": "Kamayut Interception Midpoint #16",
    "township": "Kamayut",
    "type": "interception_midpoint",
    "latitude": 16.826514,
    "longitude": 96.130672,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606550056_wgsf",
    "name": "Kamayut Interception Midpoint #17",
    "township": "Kamayut",
    "type": "interception_midpoint",
    "latitude": 16.821579,
    "longitude": 96.132109,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606560173_qeeh",
    "name": "Sanchaung Interception Midpoint #18",
    "township": "Sanchaung",
    "type": "interception_midpoint",
    "latitude": 16.814421,
    "longitude": 96.130682,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606562531_7c50",
    "name": "Kamayut Interception Midpoint #19",
    "township": "Kamayut",
    "type": "interception_midpoint",
    "latitude": 16.816912,
    "longitude": 96.126739,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606577581_jrer",
    "name": "Kamayut Interception Midpoint #20",
    "township": "Kamayut",
    "type": "interception_midpoint",
    "latitude": 16.817261,
    "longitude": 96.126101,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606580056_0if0",
    "name": "Kamayut Interception Midpoint #21",
    "township": "Kamayut",
    "type": "interception_midpoint",
    "latitude": 16.82008,
    "longitude": 96.122078,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606582748_x1rk",
    "name": "Kamayut Interception Midpoint #22",
    "township": "Kamayut",
    "type": "interception_midpoint",
    "latitude": 16.821841,
    "longitude": 96.123177,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606603639_6xqh",
    "name": "Hlaing Interception Midpoint #23",
    "township": "Hlaing",
    "type": "interception_midpoint",
    "latitude": 16.842518,
    "longitude": 96.112282,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606606948_9271",
    "name": "Hlaing Interception Midpoint #24",
    "township": "Hlaing",
    "type": "interception_midpoint",
    "latitude": 16.851154,
    "longitude": 96.109686,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606609783_umox",
    "name": "Hlaing Interception Midpoint #25",
    "township": "Hlaing",
    "type": "interception_midpoint",
    "latitude": 16.855035,
    "longitude": 96.108291,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606626564_uzgw",
    "name": "Mayangone Interception Midpoint #26",
    "township": "Mayangone",
    "type": "interception_midpoint",
    "latitude": 16.871422,
    "longitude": 96.104413,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606647639_wmai",
    "name": "Kamayut Interception Midpoint #27",
    "township": "Kamayut",
    "type": "interception_midpoint",
    "latitude": 16.928385,
    "longitude": 96.120844,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606651055_560w",
    "name": "Kamayut Interception Midpoint #28",
    "township": "Kamayut",
    "type": "interception_midpoint",
    "latitude": 16.928616,
    "longitude": 96.131305,
    "estimatedCycleSeconds": 120
  },
  {
    "id": "pt_1792606672481_wnji",
    "name": "Kamayut Interception Midpoint #29",
    "township": "Kamayut",
    "type": "interception_midpoint",
    "latitude": 16.915781,
    "longitude": 96.134663,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606694297_3xn6",
    "name": "North Okkalapa Interception Midpoint #30",
    "township": "North Okkalapa",
    "type": "interception_midpoint",
    "latitude": 16.900553,
    "longitude": 96.124374,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606701622_z9pp",
    "name": "North Okkalapa Interception Midpoint #31",
    "township": "North Okkalapa",
    "type": "interception_midpoint",
    "latitude": 16.893264,
    "longitude": 96.120018,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606705304_d7a4",
    "name": "North Okkalapa Interception Midpoint #32",
    "township": "North Okkalapa",
    "type": "interception_midpoint",
    "latitude": 16.889851,
    "longitude": 96.12115,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606726638_4jpp",
    "name": "Mayangone Interception Midpoint #33",
    "township": "Mayangone",
    "type": "interception_midpoint",
    "latitude": 16.866668,
    "longitude": 96.132174,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606745713_b97k",
    "name": "Hlaing Interception Midpoint #34",
    "township": "Hlaing",
    "type": "interception_midpoint",
    "latitude": 16.853351,
    "longitude": 96.140746,
    "estimatedCycleSeconds": 120
  },
  {
    "id": "pt_1792606764467_xtqn",
    "name": "Hlaing Interception Midpoint #35",
    "township": "Hlaing",
    "type": "interception_midpoint",
    "latitude": 16.848243,
    "longitude": 96.136674,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606778910_d5vx",
    "name": "Kamayut Interception Midpoint #36",
    "township": "Kamayut",
    "type": "interception_midpoint",
    "latitude": 16.837928,
    "longitude": 96.134427,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606797059_4s7b",
    "name": "Thaketa Interception Midpoint #37",
    "township": "Thaketa",
    "type": "interception_midpoint",
    "latitude": 16.792966,
    "longitude": 96.14037,
    "estimatedCycleSeconds": 80
  },
  {
    "id": "pt_1792606805850_7g7a",
    "name": "Thaketa Interception Midpoint #38",
    "township": "Thaketa",
    "type": "interception_midpoint",
    "latitude": 16.790156,
    "longitude": 96.14125,
    "estimatedCycleSeconds": 50
  },
  {
    "id": "pt_1792606817675_48t0",
    "name": "Kyauktada Interception Midpoint #39",
    "township": "Kyauktada",
    "type": "interception_midpoint",
    "latitude": 16.78235,
    "longitude": 96.143788,
    "estimatedCycleSeconds": 60
  },
  {
    "id": "pt_1792606829375_fwbv",
    "name": "Kyauktada Interception Midpoint #40",
    "township": "Kyauktada",
    "type": "interception_midpoint",
    "latitude": 16.779808,
    "longitude": 96.145005,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606830509_mr8v",
    "name": "Kyauktada Interception Midpoint #41",
    "township": "Kyauktada",
    "type": "interception_midpoint",
    "latitude": 16.779756,
    "longitude": 96.147773,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606833158_025i",
    "name": "Kyauktada Interception Midpoint #42",
    "township": "Kyauktada",
    "type": "interception_midpoint",
    "latitude": 16.77724,
    "longitude": 96.14772,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606838425_3eti",
    "name": "Kyauktada Interception Midpoint #43",
    "township": "Kyauktada",
    "type": "interception_midpoint",
    "latitude": 16.777322,
    "longitude": 96.145188,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606843825_zjp7",
    "name": "Kyauktada Interception Midpoint #44",
    "township": "Kyauktada",
    "type": "interception_midpoint",
    "latitude": 16.774795,
    "longitude": 96.14522,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606845050_2tbc",
    "name": "Kyauktada Interception Midpoint #45",
    "township": "Kyauktada",
    "type": "interception_midpoint",
    "latitude": 16.774805,
    "longitude": 96.147634,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606846267_oulk",
    "name": "Kyauktada Interception Midpoint #46",
    "township": "Kyauktada",
    "type": "interception_midpoint",
    "latitude": 16.772309,
    "longitude": 96.147473,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606847259_7bib",
    "name": "Kyauktada Interception Midpoint #47",
    "township": "Kyauktada",
    "type": "interception_midpoint",
    "latitude": 16.772083,
    "longitude": 96.150348,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606848358_leh6",
    "name": "Kyauktada Interception Midpoint #48",
    "township": "Kyauktada",
    "type": "interception_midpoint",
    "latitude": 16.774682,
    "longitude": 96.15038,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606852475_8ltu",
    "name": "Kyauktada Interception Midpoint #49",
    "township": "Kyauktada",
    "type": "interception_midpoint",
    "latitude": 16.774548,
    "longitude": 96.153138,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606857000_s3yh",
    "name": "Kyauktada Interception Midpoint #50",
    "township": "Kyauktada",
    "type": "interception_midpoint",
    "latitude": 16.774487,
    "longitude": 96.155874,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606858892_6x8b",
    "name": "Kyauktada Interception Midpoint #51",
    "township": "Kyauktada",
    "type": "interception_midpoint",
    "latitude": 16.776962,
    "longitude": 96.155949,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606860801_2n7x",
    "name": "Kyauktada Interception Midpoint #52",
    "township": "Kyauktada",
    "type": "interception_midpoint",
    "latitude": 16.777055,
    "longitude": 96.153224,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606863008_vuud",
    "name": "Kyauktada Interception Midpoint #53",
    "township": "Kyauktada",
    "type": "interception_midpoint",
    "latitude": 16.779407,
    "longitude": 96.158974,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606864375_e4tz",
    "name": "Kyauktada Interception Midpoint #54",
    "township": "Kyauktada",
    "type": "interception_midpoint",
    "latitude": 16.776818,
    "longitude": 96.158888,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606867500_6z8b",
    "name": "Kyauktada Interception Midpoint #55",
    "township": "Kyauktada",
    "type": "interception_midpoint",
    "latitude": 16.776726,
    "longitude": 96.161785,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606869741_0zol",
    "name": "Kyauktada Interception Midpoint #56",
    "township": "Kyauktada",
    "type": "interception_midpoint",
    "latitude": 16.776757,
    "longitude": 96.164553,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606873450_epz3",
    "name": "Thaketa Interception Midpoint #57",
    "township": "Thaketa",
    "type": "interception_midpoint",
    "latitude": 16.774086,
    "longitude": 96.167139,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606874716_7a10",
    "name": "Thaketa Interception Midpoint #58",
    "township": "Thaketa",
    "type": "interception_midpoint",
    "latitude": 16.776541,
    "longitude": 96.167278,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606876066_9052",
    "name": "Kyauktada Interception Midpoint #59",
    "township": "Kyauktada",
    "type": "interception_midpoint",
    "latitude": 16.774199,
    "longitude": 96.164371,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606877225_h0sx",
    "name": "Kyauktada Interception Midpoint #60",
    "township": "Kyauktada",
    "type": "interception_midpoint",
    "latitude": 16.774333,
    "longitude": 96.161624,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606879833_go8b",
    "name": "Kyauktada Interception Midpoint #61",
    "township": "Kyauktada",
    "type": "interception_midpoint",
    "latitude": 16.771754,
    "longitude": 96.161603,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606881409_7z3n",
    "name": "Kyauktada Interception Midpoint #62",
    "township": "Kyauktada",
    "type": "interception_midpoint",
    "latitude": 16.771662,
    "longitude": 96.164306,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606882550_r8bw",
    "name": "Thaketa Interception Midpoint #63",
    "township": "Thaketa",
    "type": "interception_midpoint",
    "latitude": 16.771497,
    "longitude": 96.167032,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606893375_vhye",
    "name": "Thaketa Interception Midpoint #64",
    "township": "Thaketa",
    "type": "interception_midpoint",
    "latitude": 16.773973,
    "longitude": 96.169896,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606894491_qe0c",
    "name": "Thaketa Interception Midpoint #65",
    "township": "Thaketa",
    "type": "interception_midpoint",
    "latitude": 16.7765,
    "longitude": 96.16996,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606896399_fro7",
    "name": "Thaketa Interception Midpoint #66",
    "township": "Thaketa",
    "type": "interception_midpoint",
    "latitude": 16.778863,
    "longitude": 96.1701,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606897608_nd0o",
    "name": "Thaketa Interception Midpoint #67",
    "township": "Thaketa",
    "type": "interception_midpoint",
    "latitude": 16.776428,
    "longitude": 96.172739,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606899041_c96h",
    "name": "Thaketa Interception Midpoint #68",
    "township": "Thaketa",
    "type": "interception_midpoint",
    "latitude": 16.778739,
    "longitude": 96.172825,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606900158_epyu",
    "name": "Thaketa Interception Midpoint #69",
    "township": "Thaketa",
    "type": "interception_midpoint",
    "latitude": 16.773891,
    "longitude": 96.172621,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606901483_67cn",
    "name": "Thaketa Interception Midpoint #70",
    "township": "Thaketa",
    "type": "interception_midpoint",
    "latitude": 16.771333,
    "longitude": 96.172557,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606904224_h0zk",
    "name": "Thaketa Interception Midpoint #71",
    "township": "Thaketa",
    "type": "interception_midpoint",
    "latitude": 16.771241,
    "longitude": 96.175314,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606905283_4uy0",
    "name": "Thaketa Interception Midpoint #72",
    "township": "Thaketa",
    "type": "interception_midpoint",
    "latitude": 16.773778,
    "longitude": 96.175389,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606906734_cfoq",
    "name": "Thaketa Interception Midpoint #73",
    "township": "Thaketa",
    "type": "interception_midpoint",
    "latitude": 16.776346,
    "longitude": 96.175507,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606908850_bkq6",
    "name": "Thaketa Interception Midpoint #74",
    "township": "Thaketa",
    "type": "interception_midpoint",
    "latitude": 16.779561,
    "longitude": 96.174402,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606910057_n1fh",
    "name": "Thaketa Interception Midpoint #75",
    "township": "Thaketa",
    "type": "interception_midpoint",
    "latitude": 16.777086,
    "longitude": 96.176527,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606912101_m6ik",
    "name": "Thaketa Interception Midpoint #76",
    "township": "Thaketa",
    "type": "interception_midpoint",
    "latitude": 16.78291,
    "longitude": 96.174177,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606918416_pw3f",
    "name": "Kamayut Interception Midpoint #77",
    "township": "Kamayut",
    "type": "interception_midpoint",
    "latitude": 16.82579,
    "longitude": 96.139426,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606927182_zobd",
    "name": "Kamayut Interception Midpoint #78",
    "township": "Kamayut",
    "type": "interception_midpoint",
    "latitude": 16.834668,
    "longitude": 96.133611,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606939591_111p",
    "name": "Mayangone Interception Midpoint #79",
    "township": "Mayangone",
    "type": "interception_midpoint",
    "latitude": 16.87865,
    "longitude": 96.126316,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606947391_pkvm",
    "name": "Kamayut Interception Midpoint #80",
    "township": "Kamayut",
    "type": "interception_midpoint",
    "latitude": 16.935919,
    "longitude": 96.153073,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606953891_ie3t",
    "name": "North Okkalapa Interception Midpoint #81",
    "township": "North Okkalapa",
    "type": "interception_midpoint",
    "latitude": 16.889214,
    "longitude": 96.132667,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606960459_dxii",
    "name": "North Okkalapa Interception Midpoint #82",
    "township": "North Okkalapa",
    "type": "interception_midpoint",
    "latitude": 16.891385,
    "longitude": 96.144426,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606972957_b7gb",
    "name": "Mayangone Interception Midpoint #83",
    "township": "Mayangone",
    "type": "interception_midpoint",
    "latitude": 16.866232,
    "longitude": 96.142591,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606982532_8p9f",
    "name": "Bahan Interception Midpoint #84",
    "township": "Bahan",
    "type": "interception_midpoint",
    "latitude": 16.829107,
    "longitude": 96.154586,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606984199_lajv",
    "name": "Bahan Interception Midpoint #85",
    "township": "Bahan",
    "type": "interception_midpoint",
    "latitude": 16.833163,
    "longitude": 96.155144,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606988323_p02p",
    "name": "Yankin Interception Midpoint #86",
    "township": "Yankin",
    "type": "interception_midpoint",
    "latitude": 16.842529,
    "longitude": 96.156485,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606991741_n1o5",
    "name": "Mayangone Interception Midpoint #87",
    "township": "Mayangone",
    "type": "interception_midpoint",
    "latitude": 16.850209,
    "longitude": 96.15759,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792606999166_tvh8",
    "name": "Mayangone Interception Midpoint #88",
    "township": "Mayangone",
    "type": "interception_midpoint",
    "latitude": 16.868804,
    "longitude": 96.147065,
    "estimatedCycleSeconds": 30
  },
  {
    "id": "pt_1792607002190_9csx",
    "name": "Mayangone Interception Midpoint #89",
    "township": "Mayangone",
    "type": "interception_midpoint",
    "latitude": 16.873486,
    "longitude": 96.150681,
    "estimatedCycleSeconds": 30
  }
] as const;
