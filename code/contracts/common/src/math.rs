//! Integer fee math. Every split rounds the first share down and gives the
//! remainder to the second share, so no dust is ever created or lost.

use crate::BPS;

/// Splits `amount` into (`floor(amount * bps / 10000)`, remainder).
pub fn split_bps(amount: u128, bps: u16) -> (u128, u128) {
    assert!(bps <= BPS, "bps over 100%");
    let first = amount
        .checked_mul(bps as u128)
        .expect("overflow in split")
        / BPS as u128;
    (first, amount - first)
}

/// F1: mint payment -> (vault share, pool share). Vault is rounded down.
pub fn mint_split(price: u128) -> (u128, u128) {
    split_bps(price, crate::MINT_VAULT_BPS)
}

/// F3: vault asset on burn -> (holder share, pool share). Holder is rounded down.
pub fn redeem_split(amount: u128) -> (u128, u128) {
    split_bps(amount, BPS - crate::REDEEM_POOL_BPS)
}

/// F8 + section 20: sale price -> (pool fee, royalty, seller proceeds).
/// Panics if pool fee plus royalty would exceed the price.
pub fn sale_split(price: u128, royalty_bps: u16) -> (u128, u128, u128) {
    assert!(
        crate::SALE_POOL_BPS as u32 + royalty_bps as u32 <= BPS as u32,
        "Pool fee plus royalty exceeds 100%"
    );
    let pool = price * crate::SALE_POOL_BPS as u128 / BPS as u128;
    let royalty = price * royalty_bps as u128 / BPS as u128;
    (pool, royalty, price - pool - royalty)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mint_split_sums_and_rounds_vault_down() {
        assert_eq!(mint_split(100), (50, 50));
        assert_eq!(mint_split(101), (50, 51));
        assert_eq!(mint_split(1), (0, 1));
        for p in [0u128, 7, 999_999, u64::MAX as u128] {
            let (v, t) = mint_split(p);
            assert_eq!(v + t, p);
        }
    }

    #[test]
    fn redeem_split_is_90_10() {
        assert_eq!(redeem_split(1_000), (900, 100));
        assert_eq!(redeem_split(9), (8, 1));
        let (h, p) = redeem_split(123_456_789);
        assert_eq!(h + p, 123_456_789);
    }

    #[test]
    fn sale_split_5_percent_plus_royalty() {
        assert_eq!(sale_split(10_000, 0), (500, 0, 9_500));
        assert_eq!(sale_split(10_000, 750), (500, 750, 8_750));
        assert_eq!(sale_split(10_000, 9_500), (500, 9_500, 0));
        let (a, b, c) = sale_split(12_345, 333);
        assert_eq!(a + b + c, 12_345);
    }

    #[test]
    #[should_panic(expected = "exceeds 100%")]
    fn sale_split_rejects_overflowing_royalty() {
        sale_split(100, 9_501);
    }
}

/// Exact `floor(a * b / c)` without overflow: the product is held in 256 bits.
/// Needed for pro-rata shares of 18-decimal tokens, where `a * b` exceeds u128.
pub fn mul_div(a: u128, b: u128, c: u128) -> u128 {
    assert!(c > 0, "division by zero");
    // 256-bit product as (hi, lo) using 64-bit limbs.
    let (a1, a0) = (a >> 64, a & u64::MAX as u128);
    let (b1, b0) = (b >> 64, b & u64::MAX as u128);
    let p00 = a0 * b0;
    let p01 = a0 * b1;
    let p10 = a1 * b0;
    let p11 = a1 * b1;
    let mid = (p00 >> 64) + (p01 & u64::MAX as u128) + (p10 & u64::MAX as u128);
    let lo = (p00 & u64::MAX as u128) | (mid << 64);
    let hi = p11 + (p01 >> 64) + (p10 >> 64) + (mid >> 64);
    if hi == 0 { return lo / c; }
    assert!(hi < c, "mul_div result overflows u128");
    // Long division of (hi, lo) by c, one bit at a time.
    let (mut rem, mut quo) = (hi, 0u128);
    for i in (0..128).rev() {
        let carry = rem >> 127;
        rem = (rem << 1) | ((lo >> i) & 1);
        quo <<= 1;
        if carry == 1 || rem >= c {
            rem = rem.wrapping_sub(c);
            quo |= 1;
        }
    }
    quo
}

#[cfg(test)]
mod mul_div_tests {
    use super::*;

    #[test]
    fn matches_plain_arithmetic_when_it_fits() {
        assert_eq!(mul_div(10, 3, 4), 7);
        assert_eq!(mul_div(0, 99, 7), 0);
        assert_eq!(mul_div(u64::MAX as u128, 1000, 7), (u64::MAX as u128 * 1000) / 7);
    }

    #[test]
    fn handles_products_larger_than_u128() {
        // 10^22 tokens x 10^24 yocto share / 10^25 = 10^21, but the product is 10^46.
        let (out, share, total) = (10u128.pow(22), 10u128.pow(24), 10u128.pow(25));
        assert_eq!(mul_div(out, share, total), 10u128.pow(21));
        // Shares sum to at most the total: floor never overpays.
        let shares = [3u128 * 10u128.pow(24), 3 * 10u128.pow(24), 4 * 10u128.pow(24)];
        let tot: u128 = shares.iter().sum();
        let paid: u128 = shares.iter().map(|s| mul_div(out + 7, *s, tot)).sum();
        assert!(paid <= out + 7 && out + 7 - paid < 3);
    }

    #[test]
    fn max_values_are_exact() {
        assert_eq!(mul_div(u128::MAX, u128::MAX, u128::MAX), u128::MAX);
        assert_eq!(mul_div(u128::MAX, 2, 4), u128::MAX / 2);
    }
}
