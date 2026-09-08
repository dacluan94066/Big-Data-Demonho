package com.hdfs.clouddrive.dto;

import lombok.Data;

/**
 * LoginRequest - Body cho POST /api/auth/login
 */
@Data
public class LoginRequest {
    private String username;
    private String password;
}
