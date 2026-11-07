//! Allowlist proofs (section 16). Leaves are sha256(account id); pairs are
//! hashed in sorted order so proofs need no left/right flags.

use near_sdk::env;

pub fn leaf(account: &str) -> [u8; 32] {
    env::sha256_array(account.as_bytes())
}

fn parent(a: [u8; 32], b: [u8; 32]) -> [u8; 32] {
    let (lo, hi) = if a <= b { (a, b) } else { (b, a) };
    let mut buf = [0u8; 64];
    buf[..32].copy_from_slice(&lo);
    buf[32..].copy_from_slice(&hi);
    env::sha256_array(&buf)
}

pub fn verify(root: &[u8; 32], account: &str, proof: &[Vec<u8>]) -> bool {
    if proof.len() > 32 {
        return false;
    }
    let mut node = leaf(account);
    for p in proof {
        let Ok(sibling) = <[u8; 32]>::try_from(p.as_slice()) else { return false };
        node = parent(node, sibling);
    }
    &node == root
}

pub fn root_of(accounts: &[&str]) -> ([u8; 32], Vec<Vec<Vec<u8>>>) {
    let mut level: Vec<[u8; 32]> = accounts.iter().map(|a| leaf(a)).collect();
    let mut proofs: Vec<Vec<Vec<u8>>> = vec![vec![]; level.len()];
    let mut idx: Vec<usize> = (0..level.len()).collect();
    while level.len() > 1 {
        let mut next = Vec::new();
        for i in (0..level.len()).step_by(2) {
            if i + 1 < level.len() {
                for (k, pos) in idx.iter().enumerate() {
                    if *pos == i { proofs[k].push(level[i + 1].to_vec()); }
                    if *pos == i + 1 { proofs[k].push(level[i].to_vec()); }
                }
                next.push(parent(level[i], level[i + 1]));
            } else {
                next.push(level[i]);
            }
        }
        for pos in idx.iter_mut() { *pos /= 2; }
        level = next;
    }
    (level[0], proofs)
}
