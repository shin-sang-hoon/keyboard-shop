package backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "orders")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "total_price", nullable = false)
    private int totalPrice;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderStatus status;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL)
    @Builder.Default
    private List<OrderItem> items = new ArrayList<>();

    // ─── PortOne 결제 식별 (6/5) ──────────────────────────────────────────
    /**
     * 가맹점(우리)이 발급하는 결제 고유번호. PortOne 결제창 요청(requestPayment)과
     * 결제완료 후 단건조회(GET /payments/{paymentId})에 모두 동일한 값이 쓰인다.
     *
     * prepare 단계에서 PENDING 주문을 저장하며 발급하고, complete 단계에서 이 값으로
     * 포트원에 조회해 실결제액과 DB 금액을 대조한다. unique 제약으로 한 결제번호가 두
     * 주문에 매핑되는 일을 DB 레벨에서 차단한다. mock/구주문은 null 일 수 있다.
     */
    @Column(name = "payment_id", unique = true)
    private String paymentId;

    /** 결제 수단(card/kakaopay 등). 결제완료 시 포트원 응답에서 받아 보존(표시용). */
    @Column(name = "pay_method")
    private String payMethod;

    // ─── 배송지 (6/5) ─────────────────────────────────────────────────────
    // 결제 시점에 입력받아 주문과 함께 저장. 회원정보 주소와 별개(주문마다 다를 수 있음).
    @Column(name = "receiver_name")
    private String receiverName;

    @Column(name = "receiver_phone")
    private String receiverPhone;

    @Column(name = "postcode")
    private String postcode;

    @Column(name = "address")
    private String address;

    @Column(name = "address_detail")
    private String addressDetail;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
        if (this.status == null) this.status = OrderStatus.PENDING;
    }

    public enum OrderStatus {
        PENDING, PAID, SHIPPING, DELIVERED, CANCELLED
    }
}
