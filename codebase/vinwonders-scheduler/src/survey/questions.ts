export type QuestionOption = { value: string; label: string; icon: string }
export type Question = {
  id: 'time' | 'group' | 'intensity' | 'interests' | 'pace' | 'avoid'
  title: string
  multi: boolean
  options: QuestionOption[]
}

export const QUESTIONS: Question[] = [
  {
    id: 'time', title: 'Bạn dự định chơi trong khung giờ nào?', multi: false,
    options: [
      { value: 'full', label: 'Cả ngày (9:00–19:00)', icon: '🌅' },
      { value: 'morning', label: 'Buổi sáng (9:00–13:00)', icon: '☀️' },
      { value: 'afternoon', label: 'Chiều–tối (13:00–19:30)', icon: '🌇' },
    ],
  },
  {
    id: 'group', title: 'Bạn đi cùng ai?', multi: false,
    options: [
      { value: 'solo', label: 'Một mình', icon: '🧍' },
      { value: 'couple', label: 'Cặp đôi', icon: '💑' },
      { value: 'friends', label: 'Nhóm bạn', icon: '👥' },
      { value: 'family', label: 'Gia đình có trẻ nhỏ', icon: '👨‍👩‍👧' },
    ],
  },
  {
    id: 'intensity', title: 'Bạn thích cảm giác thế nào?', multi: false,
    options: [
      { value: 'high', label: 'Mạo hiểm tối đa', icon: '🎢' },
      { value: 'balanced', label: 'Cân bằng', icon: '⚖️' },
      { value: 'gentle', label: 'Nhẹ nhàng thư giãn', icon: '🌴' },
      { value: 'kids', label: 'Hợp trẻ nhỏ', icon: '🧸' },
    ],
  },
  {
    id: 'interests', title: 'Bạn mê kiểu trải nghiệm nào? (chọn nhiều)', multi: true,
    options: [
      { value: 'thrill', label: 'Tàu lượn mạnh', icon: '🎢' },
      { value: 'water', label: 'Công viên nước', icon: '🌊' },
      { value: 'aquarium', label: 'Thuỷ cung', icon: '🐠' },
      { value: 'show', label: 'Show & sống ảo', icon: '🎆' },
      { value: 'indoor', label: 'Cổ tích / trong nhà', icon: '🏰' },
      { value: 'adventure', label: 'Khám phá phiêu lưu', icon: '🗺️' },
    ],
  },
  {
    id: 'pace', title: 'Nhịp độ bạn muốn?', multi: false,
    options: [
      { value: 'relaxed', label: 'Thong thả, nghỉ nhiều', icon: '🐢' },
      { value: 'balanced', label: 'Cân bằng', icon: '⚖️' },
      { value: 'packed', label: 'Chơi hết mình', icon: '🚀' },
    ],
  },
  {
    id: 'avoid', title: 'Có điều gì cần tránh không? (có thể bỏ trống)', multi: true,
    options: [
      { value: 'heights', label: 'Sợ độ cao', icon: '😱' },
      { value: 'wet', label: 'Không thích bị ướt', icon: '💧' },
      { value: 'queue', label: 'Ngại xếp hàng lâu', icon: '⏳' },
      { value: 'vegetarian', label: 'Ăn chay', icon: '🥗' },
      { value: 'allergy', label: 'Dị ứng / đồ ăn riêng', icon: '⚠️' },
    ],
  },
]
