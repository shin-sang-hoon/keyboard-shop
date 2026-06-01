package backend.service;

import backend.entity.Product;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 3D 빌더 커스텀 옵션 단가 계산기 (단일 진실 원천).
 *
 * 가격 위변조 방어의 핵심:
 *   클라이언트가 보낸 금액은 절대 신뢰하지 않고, 옵션 ID(layout/switchType/keycapColor)만
 *   받아서 서버 가격표로 단가를 재계산한다. cart 담기 · sync · order 생성에서 모두 이 한 곳을
 *   호출하므로, 어느 경로로 들어와도 가격이 어긋날 수 없다.
 *
 * 가격표는 프론트 KeyboardBuilder.jsx 의 옵션 가격과 일치한다.
 * (케이스 색은 가격에 영향 없음 — 표시용)
 */
@Component
public class BuilderPriceCalculator {

    private static final Map<String, Integer> LAYOUT_PRICE = Map.of(
            "65", 79000, "75", 89000, "TKL", 109000, "FULL", 129000);
    private static final Map<String, Integer> SWITCH_PRICE = Map.of(
            "LINEAR", 25000, "TACTILE", 28000, "CLICKY", 30000);
    private static final Map<String, Integer> KEYCAP_PRICE = Map.ofEntries(
            Map.entry("original", 0),
            Map.entry("white", 35000),
            Map.entry("black", 35000),
            Map.entry("gray", 38000),
            Map.entry("navy", 38000),
            Map.entry("red", 42000),
            Map.entry("mint", 42000));

    /**
     * 옵션 반영 단가를 서버에서 재계산.
     * 옵션이 전혀 없으면(일반 상품) null 반환 → product.price 를 단가로 사용.
     *
     * 공식: (product.price 또는 layout 기본가) + 스위치 추가금 + 키캡 추가금
     */
    public Integer calcUnitPrice(Product product, String layout, String switchType, String keycapColor) {
        if (layout == null && switchType == null && keycapColor == null) {
            return null; // 일반 상품 → product.price 사용
        }
        int base = (product.getPrice() != null)
                ? product.getPrice()
                : LAYOUT_PRICE.getOrDefault(layout, 0);
        int sw = (switchType != null) ? SWITCH_PRICE.getOrDefault(switchType, 0) : 0;
        int kc = (keycapColor != null) ? KEYCAP_PRICE.getOrDefault(keycapColor, 0) : 0;
        return base + sw + kc;
    }
}
