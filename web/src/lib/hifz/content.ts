// Words shown to the learner, kept in one place.

export const WHY_REASONS = [
  {
    title: "It is made easy for you",
    text: "“And We have certainly made the Quran easy to remember. So is there anyone who will be mindful?”",
    source: "Quran 54:17",
    href: "https://quran.com/54/17",
  },
  {
    title: "The best of people",
    text: "“The best among you are those who learn the Qur’an and teach it.”",
    source: "Sahih al-Bukhari 5027",
    href: "https://sunnah.com/bukhari:5027",
  },
  {
    title: "Struggling is rewarded twice",
    text: "The one proficient in the Quran is with the noble, upright angels, “and he who falters in it, and finds it difficult for him, will have two rewards.”",
    source: "Sahih Muslim 798a",
    href: "https://sunnah.com/muslim:798a",
  },
  {
    title: "Recite and rise",
    text: "The companion of the Quran will be told to recite and ascend, “for he will reach his abode when he comes to the last verse he recites.”",
    source: "Sunan Abi Dawud 1464, graded hasan sahih by al-Albani",
    href: "https://sunnah.com/abudawud:1464",
  },
  {
    title: "An intercessor on the Last Day",
    text: "“Recite the Qur’an, for on the Day of Resurrection it will come as an intercessor for those who recite it.”",
    source: "Sahih Muslim 804a",
    href: "https://sunnah.com/muslim:804a",
  },
] as const;

export const STAGE_INFO = {
  sabaq: { name: "Sabaq", tagline: "Learn something new", blurb: "Listen, read, let it blur, then recite it from memory." },
  sabqi: { name: "Sabqi", tagline: "Lock in what's recent", blurb: "Your last few sabaqs and the quarter juz before them." },
  dawr: { name: "Dawr", tagline: "Keep it all fresh", blurb: "Your rotation, weakest pages first. Spread it through the day." },
} as const;

export const ENCOURAGEMENT = [
  "Every clean repetition is a brick laid.",
  "Slow is smooth, and smooth lasts.",
  "A stuck word today is tomorrow's strongest.",
  "Small and constant beats big and rare.",
];
