package com.hdfs.clouddrive.controller;

import com.hdfs.clouddrive.dto.LoginRequest;
import com.hdfs.clouddrive.dto.LoginResponse;
import com.hdfs.clouddrive.model.User;
import com.hdfs.clouddrive.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * AuthController - Xử lý đăng nhập/đăng xuất
 *
 * API:
 *   POST /api/auth/login   → đăng nhập
 *   POST /api/auth/logout  → đăng xuất
 *
 * Lưu ý: Đây là authentication đơn giản cho mục đích DEMO.
 * Production thực tế nên dùng JWT hoặc Spring Security.
 */
@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;

    /**
     * POST /api/auth/login
     * Body: { "username": "admin", "password": "123456" }
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        log.info("[Auth] Login attempt: username={}", request.getUsername());

        if (request.getUsername() == null || request.getPassword() == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Username và password không được để trống"));
        }

        Optional<User> userOpt = userRepository.findByUsername(request.getUsername());

        if (userOpt.isEmpty() || !userOpt.get().getPassword().equals(request.getPassword())) {
            log.warn("[Auth] Login failed: username={}", request.getUsername());
            return ResponseEntity.status(401)
                    .body(Map.of("error", "Tên đăng nhập hoặc mật khẩu không đúng"));
        }

        User user = userOpt.get();

        // Tạo token đơn giản (UUID) - Demo only
        // Production: dùng JWT với expiration và secret key
        String token = UUID.randomUUID().toString();

        log.info("[Auth] Login successful: username={}", user.getUsername());

        return ResponseEntity.ok(new LoginResponse(
                token,
                user.getUsername(),
                user.getFullName(),
                "Đăng nhập thành công! Chào mừng " + user.getFullName()
        ));
    }

    /**
     * POST /api/auth/logout
     */
    @PostMapping("/logout")
    public ResponseEntity<?> logout(
            @RequestHeader(value = "X-Username", defaultValue = "unknown") String username) {
        log.info("[Auth] User logged out: {}", username);
        return ResponseEntity.ok(Map.of("message", "Đăng xuất thành công"));
    }
}
