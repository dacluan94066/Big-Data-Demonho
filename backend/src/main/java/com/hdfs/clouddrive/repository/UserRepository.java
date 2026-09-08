package com.hdfs.clouddrive.repository;

import com.hdfs.clouddrive.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    /** Tìm user theo username (dùng để đăng nhập) */
    Optional<User> findByUsername(String username);
}
