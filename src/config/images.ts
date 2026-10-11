import heroHotelImg from '../assets/images/hero_udaipur_sandstone_resort_1791661853086.jpg';
import suiteHotelImg from '../assets/images/hotel_walnut_linen_suite_1791661864366.jpg';
import airlinerSunsetImg from '../assets/images/flight_wing_golden_clouds_1791661876082.jpg';
import execSedanImg from '../assets/images/car_espresso_executive_saloon_1791661886237.jpg';

export const IMAGE_MAP: Record<string, string> = {
  hero_hotel: heroHotelImg,
  suite_hotel: suiteHotelImg,
  airliner_sunset: airlinerSunsetImg,
  exec_sedan: execSedanImg,
};

export function getImageUrl(key: string): string {
  return IMAGE_MAP[key] || heroHotelImg;
}
