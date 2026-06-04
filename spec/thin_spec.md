# Template — Thin SPEC Cuối Day 05

Thin SPEC không phải PRD đầy đủ. Đây là bản cam kết đủ rõ để sáng Day 06 nhóm build ngay.

## 1. Track, product/app và user

**Track:** AI Agent / Personal Assistant  
**Product/app thật:** Trợ lý AI lên lịch trình và cá nhân hóa trải nghiệm vui chơi tại VinWonders.  
**User cụ thể:** Khách du lịch (đoàn gia đình, nhóm bạn) đến vui chơi trong ngày.  
**Nhóm có phải user thật không? Nếu không, khác ở đâu?** Có và Không. Nhóm cũng đi chơi công viên giải trí, nhưng nhóm có tư duy công nghệ, sẵn sàng chat dài với AI. User thực tế (khách du lịch) thường đang di chuyển, mệt mỏi, lười gõ dài, ưu tiên tương tác nhanh, trực quan và ít rườm rà.

## 2. Evidence summary

| Evidence | Nguồn | User/pain nói lên điều gì? | SPEC phải đổi gì? |
|---|---|---|---|
| Khách phải đọc tài liệu/app liệt kê mô tả và giờ giấc để tự xếp lịch. | Quan sát / Trải nghiệm thực tế | Quá tải thông tin (Information overload). Khách mất thời gian làm công việc "lọc" và "ghép" lịch thay vì tận hưởng. | Cần Agent lấy "constraints" (thời gian, sở thích) làm input và trả ra kết quả đã được filter/tối ưu sẵn. |
| Các show diễn/sự kiện đinh thường có khung giờ cố định. | Quy định vận hành VinWonders | Khách dễ bị lỡ sự kiện do mải chơi hoặc không ước lượng đúng thời gian di chuyển. | Agent phải tự tính toán thời gian tham gia + thời gian di chuyển để đảm bảo khách không bị trễ. |

## 3. Pain statement

```text
User [khách du lịch theo đoàn/gia đình] đang gặp khó ở [bước lên lịch trình các trò chơi/sự kiện trong ngày],
vì [phải đọc và tự đối chiếu thủ công hàng tá mô tả trò chơi, khung giờ hoạt động với quỹ thời gian trống và sở thích của từng thành viên],
dẫn tới [lãng phí thời gian chơi, dễ bỏ lỡ các show diễn cố định giờ, hoặc kiệt sức vì sắp xếp lịch trình không hợp lý].
Bằng chứng chính là [khách mất nhiều thời gian tra cứu, đọc mô tả trên bản đồ/tờ rơi và gặp khó khăn trong việc chốt điểm đến tiếp theo].
```

## 4. Build slice

```text
Cho [đoàn khách du lịch] đang [tìm kiếm trò chơi/sự kiện tiếp theo trong ngày],
prototype sẽ dùng AI để [automate việc lọc thông tin dựa trên 3 constraints: giờ bắt đầu, giờ phải về, thời gian trống/nghỉ ngơi; và sở thích],
tạo ra [1-3 option sự kiện/trò chơi phù hợp nhất kèm thời gian tham gia dự kiến],
và xử lý [failure mode: user đưa ra các ràng buộc thời gian quá hẹp hoặc mâu thuẫn] bằng [mitigation: chủ động giải thích lý do không hợp lệ và gợi ý các lựa chọn thay thế gần nhất].
```

## 5. Auto/Aug decision

Chọn một:

- [x] **Augmentation:** AI gợi ý/draft/phân loại, user quyết cuối.
- [ ] **Conditional automation:** AI tự làm trong case hẹp; case mơ hồ/rủi ro chuyển người.
- [ ] **Automation:** AI tự quyết và tự hành động.

**Lý do chọn:** Vui chơi là trải nghiệm mang tính cảm xúc và sở thích cá nhân rất cao. AI không thể tự tiện quyết định thay khách rằng họ *phải* chơi trò gì. AI chỉ gánh phần việc nặng nhọc (tính toán thời gian, lọc data), khách hàng vẫn phải là người chốt hạ (chọn sự kiện) để có cảm giác làm chủ lịch trình.  
**Human role:** decider 

## 6. Four paths

| Path | Prototype phải thể hiện gì? |
|---|---|
| Happy | User nhập đủ ràng buộc (thời gian + sở thích) -> AI list ra 2 option -> User chọn 1 -> AI lưu vào lịch trình (chốt) và hỏi tiếp muốn làm gì cho khoảng thời gian trống kế tiếp. |
| Low-confidence | User nhập sở thích quá chung chung (VD: "Có trò nào vui không?") hoặc không nhập thời gian cụ thể -> AI hỏi lại 1-2 câu ngắn để làm rõ (VD: "Đoàn mình có trẻ em không? Mình thích chơi trong nhà hay ngoài trời?"). |
| Failure | Quỹ thời gian của user quá ngắn cho một trò chơi (VD: rảnh 15p nhưng trò chơi mất 30p) HOẶC user chọn chơi trò A vào khung giờ mà trò đó đóng cửa/bảo trì. |
| Correction | User đổi ý ("Thôi không chơi tàu lượn nữa, xoá đi") -> AI phải update lại context, huỷ lịch sự kiện đó, và tính toán lại quỹ thời gian trống để gợi ý phương án mới. |

## 7. Failure mode nguy hiểm nhất

```text
Nếu user [chọn liên tiếp nhiều sự kiện ở cách xa nhau hoặc lịch trình quá sát giờ],
AI có thể [vẫn gợi ý và lưu lịch trình mà bỏ qua thời gian di chuyển/xếp hàng],
hậu quả là [khách đến nơi thì show đã đóng cửa, hoặc phải chạy bộ mệt mỏi gây bực tức].
Prototype sẽ xử lý bằng [ask again: AI tự động cộng thêm buffer time (thời gian di chuyển) và cảnh báo: "Bạn sẽ mất 15p đi bộ đến đó, lịch trình khá sát, bạn có muốn đổi sang trò X gần đây hơn không?"].
```

## 8. Owner plan cho sáng Day 06 (Tentative)

| Thành viên | Việc phụ trách | Bằng chứng cần có trong repo |
|---|---|---|
| Huỳnh An Nghiệp - 2A202600853 | Research / evidence | Bảng data tổng hợp các trò chơi, khung giờ show diễn tại VinWonders để làm context cho Agent. |
| Đỗ Thị Huyền - 2A202600880 | SPEC | Bản Thin SPEC hoàn thiện, file thiết kế luồng hội thoại (user flow/prompt design). |
| Nguyễn Hoàng Long - 2A202600785 & Vũ Minh Duy - 2A202600806 | Prototype | Source code tích hợp Agent (Function Calling/Logic xử lý constraints) và Giao diện chat (Streamlit/Gradio). |
| Phùng Bá Quân - 2A202600866 | Test / failure path | Log/Screenshot các test case rủi ro (lịch quá sát, nhập sai giờ, user đổi ý). |
| Phan Anh Thắng - 2A202600844 | Demo script / repo | Kịch bản quay video demo, file README.md hướng dẫn setup và chạy code. |

Lưu ý: phần chia nhiệm vụ theo task này có thể thay đổi tùy theo tiến độ để đảm bảo kết quả đầu ra sản phầm của cả team.