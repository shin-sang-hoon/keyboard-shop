package backend.repository;

import backend.entity.CustomBuild;
import backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CustomBuildRepository extends JpaRepository<CustomBuild, Long> {
    List<CustomBuild> findByUser(User user);
    List<CustomBuild> findByUserOrderByCreatedAtDesc(User user);
}