# SPEC Cuối Day 06

Ở Day 5, mỗi nhóm đã viết một bản SPEC nhẹ. Đến Day 6, nhóm hoàn thiện bản này cho đủ để bắt tay vào build và mang đi demo — vẫn ngắn gọn, nhưng đủ để bảo vệ được những quyết định sản phẩm của mình.

Hãy hình dung SPEC như một lập luận, chứ không phải một danh sách tính năng. Nó cần trả lời rõ bốn câu hỏi: sản phẩm giải vấn đề gì và cho ai, AI tham gia quyết định điều gì, chuyện gì xảy ra khi AI trả lời sai, và những nhận định của nhóm dựa trên bằng chứng nào.

Viết SPEC vào `spec/spec.md`, có thể kèm slide demo (`spec/demo-slides.pdf`).


## 1. Track, product/app và user

**Track:** AI Agent Assistant  
**Product/app thật:** Trợ lý AI lên lịch trình và cá nhân hóa trải nghiệm vui chơi tại VinWonders.  
**User cụ thể:** Khách du lịch (đoàn gia đình, nhóm bạn hoặc cá nhân) đến vui chơi trong ngày tại VinWonder Phú Quốc.  
**Nhóm có phải user thật không? Nếu không, khác ở đâu?** Có, nhóm là khách du lịch thực tế, đã từng trải nghiệm VinWonders Phú Quốc và hiểu rõ những khó khăn khi lên lịch trình vui chơi trong ngày. Bởi VinWonder là một tổ hợp vui chơi giải trí gồm rất nhiều trò chơi và hoạt động khác nhau, phục vụ cho mọi độ tuổi, du khách thường sẽ không biết bắt đầu từ đâu và thiết kế lịch trình phù hợp với đặc trưng của từng đoàn. Việc sử dụng trợ lý AI khi bắt đầu trải nghiệm ở VinWonder sẽ giúp du khách tối ưu quãng đường di chuyển, thời gian và phù hợp với sở thích của từng thành viên trong đoàn, từ đó có một ngày vui chơi trọn vẹn và đáng nhớ hơn.


## 2. Bằng chứng và pain statement


### Bằng chứng
Mỗi nhận định nên đi kèm trích dẫn, ảnh chụp màn hình hoặc một quan sát cụ thể. Nếu có ý nào nhóm chưa tìm được nguồn từ bên ngoài, hãy ghi rõ đó là giả định thay vì trình bày như một sự thật.

Những nỗi đau mà nhóm muốn giải quyết đến từ trải nghiệm thực tế của thành viên trong nhóm đã nhiều lần đến chơi ở VinWonders Phú Quốc. Mỗi lần đến, nhóm đều phải dành thời gian để đọc bản đồ, tờ rơi, được phát bởi nhân viên VinWonders để lên lịch trình cho cả đoàn. Việc này thường khá phức tạp bởi bản đồ VinWonder được thiết kế nhiều màu sắc, nhiều biểu tượng và thông tin chi tiết về từng trò chơi, nhưng lại không có một công cụ nào giúp khách hàng lọc và sắp xếp các trò chơi dựa trên thời gian, sở thích và đặc điểm của đoàn. Điều này dẫn đến việc khách hàng mất nhiều thời gian để đọc và đối chiếu thông tin, dễ bị quá tải và bỏ lỡ những trải nghiệm thú vị. Bằng chứng là mỗi lần đến chơi, nhóm đều phải dành ít nhất 5-10 phút để lên lịch trình cho trò chơi tiếp theo, và thường xuyên gặp khó khăn trong việc chốt điểm đến tiếp theo khi đang ở trong công viên. Việc này đôi khi làm nhóm lỡ mất một vài sự kiện đặc biết như show biểu diễn cá heo được diễn ra tại công viên nước vào lúc 12h trưa, hay là show Once nhạc nước vào lúc 7h tối. Dưới đây là một hình ảnh mẫu thể hiện sự phức tạp của bản đồ hiển thị trò chơi và sự quá tải thông tin mà khách hàng phải đối mặt khi lên lịch trình:

![Bản đồ VinWonders Phú Quốc](VinWonder_map.jpg)

### Pain statement

```text
User [khách du lịch theo đoàn/gia đình] đang gặp khó ở [bước lên lịch trình các trò chơi/sự kiện trong ngày],
vì [phải đọc và tự đối chiếu thủ công hàng tá mô tả trò chơi, khung giờ hoạt động với quỹ thời gian trống và sở thích của từng thành viên],
dẫn tới [lãng phí thời gian chơi, dễ bỏ lỡ các show diễn cố định giờ, hoặc kiệt sức vì sắp xếp lịch trình không hợp lý].
Bằng chứng chính là [khách mất nhiều thời gian tra cứu, đọc mô tả trên bản đồ/tờ rơi và gặp khó khăn trong việc chốt điểm đến tiếp theo].
```

## 3. Lát cắt để build

Lát cắt mà nhóm build chính là agent sẽ hỗ trợ người dùng dưới một vài contrains cụ thể, bao gồm việc người dùng cần mô tả cho trợ lý AI về thời gian đến và thời gian về, số lượng người trong đoàn, có trẻ nhỏ hay không, và sở thích chung của đoàn. Dựa trên những thông tin này, agent sẽ đưa ra một lịch trình được tối ưu hóa với 1 vài lựa chọn trò chơi/sự kiện phù hợp nhất. Trong trường hợp người dùng đưa ra các ràng buộc thời gian quá hẹp hoặc mâu thuẫn (ví dụ: chỉ có 30 phút nhưng muốn chơi một trò mất 1 tiếng), agent sẽ chủ động giải thích lý do không hợp lệ và gợi ý các lựa chọn thay thế gần nhất.

## 4. AI Product Canvas


| Ô | Câu hỏi cần trả lời | Câu trả lời |
|---|---------------------|-------------|
| **Value** — Giá trị | Sản phẩm dành cho ai, họ đau ở đâu, và AI giải được điều gì mà cách làm hiện tại chưa giải tốt? | Dành cho khách đi VinWonders theo gia đình/nhóm; AI giúp chốt lịch trình nhanh, đúng sở thích và tránh bỏ lỡ show hay.
| **Trust** — Niềm tin | Khi AI trả lời sai, người dùng nhận ra bằng cách nào, và họ sửa lại, hoàn tác hay chuyển sang người thật ra sao? | Nếu lịch không hợp lý, người dùng thấy ngay qua conflict về thời gian, họ có thể cung cấp lại thông tin về số người, thời gian, sở thích hoặc bỏ mục đã được gợi ý trước đó trong lịch trình.
| **Feasibility** — Tính khả thi | Có đáng để build không? Hãy cân nhắc chi phí mỗi lượt gọi, độ trễ, dữ liệu cần có, rủi ro lớn nhất, và ngưỡng mà nhóm sẵn sàng dừng lại. | Có thể build được vì dữ liệu điểm chơi và khung giờ đã có, rủi ro lớn nhất là sai giờ hoặc gợi ý không phù hợp.
| **Tín hiệu học** | Khi người dùng chỉnh sửa kết quả, dữ liệu đó đi về đâu và giúp sản phẩm khá lên nhờ tín hiệu nào? | Mỗi lần người dùng chỉnh lịch, hệ thống ghi lại điểm bị bỏ, lựa chọn thay thế để cải thiện gợi ý sau.

## 5. Tăng năng lực hay tự động hóa

**Lý do chọn:** Vui chơi là trải nghiệm mang tính cảm xúc và sở thích cá nhân rất cao. AI không thể tự tiện quyết định thay khách rằng họ *phải* chơi trò gì. AI chỉ gánh phần việc nặng nhọc (tính toán thời gian, lọc data), khách hàng vẫn phải là người chốt hạ (chọn sự kiện) để có cảm giác làm chủ lịch trình.  
**Human role:** decider

Nhóm chọn mức độ cho lát cắt này, thay vì việc AI sẽ hành động để đặt lịch cho từng sự kiện bởi việc chọn cuối cùng nên được thực hiện bởi khách hàng để đảm bảo họ cảm thấy có quyền kiểm soát và phù hợp với sở thích cá nhân của họ. AI sẽ cung cấp các gợi ý dựa trên thông tin đã được cung cấp, nhưng khách hàng sẽ là người quyết định cuối cùng về việc chọn sự kiện nào để tham gia. Điều này cũng giúp tránh được rủi ro khi AI có thể gợi ý một lịch trình không phù hợp hoặc không chính xác.

## 6. Bốn đường đi của trải nghiệm

Một tính năng AI không chỉ có đường thuận. Nhóm cần thiết kế cho cả bốn tình huống mà người dùng có thể gặp:

| Đường đi | Câu hỏi | cách xử lý |
|----------|---------|------------------|
| **Đường thuận** | AI đúng và tự tin — người dùng thấy gì? | AI trả ra lịch trình rõ ràng, có thứ tự điểm đến, giờ đi, giờ chơi; người dùng không cần mô tả lại hay bấm xóa sự kiện trong danh sách gợi ý. |
| **Khi AI không chắc** | AI lưỡng lự — có hỏi lại không? | AI hỏi thêm thông tin còn thiếu, khi nào đủ rồi mới đưa gợi ý |
| **Khi AI sai** | Kết quả sai — người dùng gỡ ra thế nào? | người dùng có thể sửa cho AI |
| **Khi người dùng sửa** | Người dùng chỉnh lại — dữ liệu đi về đâu? | Các chỉnh sửa được lưu lại để cập nhật và gợi ý lại. |

Ví dụ về đường thuận (happy case):

![Ví dụ về đường thuận](duongthuan.png)

Ví dụ về khi AI không chắc (low-confidence case), AI sẽ hỏi lại người dùng để thu thập đủ thông tin về mong muốn và đặc tính của khách hàng:

![Ví dụ về khi AI không chắc](AIkhongro.png)

Ví dụ về khi AI sai (failure case), AI mô tả ăn trưa sau khi chơi nhưng trong lịch trình lại hiện ra ăn trưa trước rồi mưới chơi, hệ thống xử lý bằng cách cho phép người dùng chỉnh sửa lại lịch trình bằng cách thông báo cho trợ lý:

![Ví dụ về khi AI sai](AIsai.png)

Ví dụ về khi người dùng sửa (correction case), người dùng muốn bỏ một sự kiện đã được gợi ý trước đó, hệ thống sẽ cập nhật lại lịch trình và lưu lại dữ liệu để cải thiện gợi ý sau này:

![Ví dụ về khi người dùng sửa](nguoidungsua.png)

## 7. Những kiểu lỗi đáng lo nhất

Những kiểu lỗi đáng lo nhất ví dụ như AI gợi ý lịch trình mà không có thời gian nghỉ trưa, hoặc là gợi ý lịch trình mà có sự kiện trùng giờ. Những lỗi này thường xuất hiện khi người dùng cung cấp thông tin không đầy đủ hoặc mâu thuẫn về thời gian. TUy nhiên, khách hàng có thể bảo AI sửa lại hoặc thay đổi lại lịch trình chứ AI không quyết định lịch trình thay con người, nên nếu xảy ra cũng không quá ảnh hưởng đến trải nghiệm của khách hàng. Trong trường hợp này, hệ thống sẽ xử lý bằng cách cho phép người dùng chỉnh sửa lại lịch trình bằng cách thông báo cho trợ lý AI về sự mâu thuẫn hoặc thiếu sót trong lịch trình đã được gợi ý, và yêu cầu AI đưa ra một lịch trình mới phù hợp hơn.

## 8. Kế hoạch kiểm thử và bằng chứng demo

Kế hoạch kiểm thử của chúng tôi bao gồm thực hiện các prompt injection để moi thông tin nhạy cảm từ hệ thống, nhưng hệ thống đã phản hồi tốt bằng việc từ chối các câu hỏi không liên quan và các thông tin nhạy cảm.

![prompt injection](prompt_injection.png)

## 9. Phân công


| Thành viên | Việc phụ trách | 
|---|---|
| Huỳnh An Nghiệp - 2A202600853 | Demo, Frontend, thiết kế luồng AI |
| Đỗ Thị Huyền - 2A202600880 | Testing hệ thống, dữ liệu |  
| Nguyễn Hoàng Long - 2A202600785 | Testing hệ thống & làm spec  |  
| Phùng Bá Quân - 2A202600866 | Testing hệ thống & làm slide |  
| Phan Anh Thắng - 2A202600844 | Backend |  
| Vũ Minh Duy - 2A202600806 | Tool | 










